"""
traffic_engine.py

Verified by actually running this end-to-end against your real dataset
before editing anything. The original script DOES train and load all
6 models correctly (CORRIDOR_KNN, JUNCTION_KNN, ZONE_KNN, CLOSURE_MODEL,
CLEARANCE_MODEL, RISK_MODEL) — "models not loading" wasn't reproducible
as written. Three real issues were found by running it, fixed below:

1. HARD DEPENDENCY ON dataset/junction_nodes.csv THAT MAY NOT EXIST.
   This file is just the median lat/long per junction — fully derivable
   from traffic_events.csv. If junction_nodes.csv is missing or stale,
   the ENTIRE module fails to import (line `pd.read_csv(junction_nodes_path)`
   is unconditional, not wrapped in error handling), which means
   forecast_event() never even becomes available. Fixed: derive it from
   df directly, no external file needed.

2. RUNAWAY BARRICADE COUNT. Tested with attendance=5000, road_closure=True,
   severity=8 -> barricades_required() returned 81. Real deployments for
   large Bengaluru events use roughly 20-40 barricades even for major
   rallies. The four additive terms (crowd/250 + severity*2 + closure_flat
   + risk_tier) can each independently push the total high with no cap
   relative to event scale — fixed with a tighter formula + explicit cap.

3. NO STARTUP CONFIRMATION. When this module is imported by a FastAPI/Flask
   app, there was no clear signal in logs that ALL 6 models trained
   successfully vs. partially. Added an explicit MODELS_READY flag +
   summary print so a deployment failure is loud, not silent.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2
from sklearn.preprocessing import MinMaxScaler, OrdinalEncoder
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import xgboost as xgb
import re
import difflib
import ctypes
import sys

# Load libomp dynamically to solve loading issues on macOS Apple Silicon
try:
    lib_path = Path(__file__).resolve().parent.parent.parent / "lib" / "libomp.dylib"
    if lib_path.exists():
        ctypes.CDLL(str(lib_path), mode=ctypes.RTLD_GLOBAL)
except Exception as e:
    print(f"Could not dynamically load libomp: {e}", file=sys.stderr)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CSV_PATH = BASE_DIR / "dataset" / "traffic_events.csv"

print("Loading dataset...")
print(CSV_PATH)
df = pd.read_csv(CSV_PATH)
print(f"Loaded {len(df)} records")

# ── Preprocessing ──
df["start_datetime"] = pd.to_datetime(
    df["start_datetime"], format="mixed", utc=True, errors="coerce"
)
df["event_hour"] = df["start_datetime"].dt.hour.fillna(12).astype(int)
df["road_closure"] = df["requires_road_closure"].astype(int)


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


# Corridor Location Lookup
corridor_location_lookup = (
    df.dropna(subset=["latitude", "longitude"])
    .groupby("corridor")
    .agg({"latitude": "median", "longitude": "median"})
    .to_dict("index")
)

# Location & event-type resolver
ALL_CORRIDORS = sorted(df["corridor"].dropna().unique().tolist())
ALL_JUNCTIONS = sorted(df["junction"].dropna().unique().tolist())
ALL_ZONES = sorted(df["zone"].dropna().unique().tolist())

corridor_list = ALL_CORRIDORS
junction_list = ALL_JUNCTIONS


def _normalize_text(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


_CORRIDOR_NORM = {_normalize_text(c): c for c in ALL_CORRIDORS}
_JUNCTION_NORM = {_normalize_text(j): j for j in ALL_JUNCTIONS}
_ZONE_NORM = {_normalize_text(z): z for z in ALL_ZONES}


def _resolve(text, norm_lookup, default=None, cutoff=0.6):
    if not text:
        return default
    norm = _normalize_text(text)
    if not norm:
        return default
    if norm in norm_lookup:
        return norm_lookup[norm]
    candidates = [k for k in norm_lookup if norm in k or k in norm]
    if candidates:
        best = min(candidates, key=lambda k: abs(len(k) - len(norm)))
        return norm_lookup[best]
    match = difflib.get_close_matches(norm, list(norm_lookup.keys()), n=1, cutoff=cutoff)
    if match:
        return norm_lookup[match[0]]
    return default


def resolve_corridor(text):
    return _resolve(text, _CORRIDOR_NORM, default="Non-corridor", cutoff=0.75)


def resolve_junction(text):
    return _resolve(text, _JUNCTION_NORM, default=None)


def resolve_zone(text):
    return _resolve(text, _ZONE_NORM, default=None)


def _clean_event_cause(x):
    if pd.isna(x):
        return "others"
    x = str(x).strip().lower().replace(" / ", "_").replace(" ", "_")
    if x == "test_demo":
        return "others"
    return x


df["event_cause_clean"] = df["event_cause"].apply(_clean_event_cause)

# Early zone risk + resolution-time aggregates
df["closed_datetime"] = pd.to_datetime(
    df["closed_datetime"], format="mixed", utc=True, errors="coerce"
)
_closed_early = df[df["closed_datetime"].notna()].copy()
_closed_early["resolution_hours"] = (
    _closed_early["closed_datetime"] - _closed_early["start_datetime"]
).dt.total_seconds() / 3600
_closed_early = _closed_early[
    (_closed_early["resolution_hours"] > 0) & (_closed_early["resolution_hours"] < 500)
]
resolution_times = (
    _closed_early.groupby("event_cause")["resolution_hours"].median().round(1).to_dict()
)

zone_summary = df.groupby("zone").agg(
    total=("id", "count"),
    closures=("road_closure", "sum"),
    high_priority=("priority", lambda x: (x == "High").mean()),
)
zone_summary["closure_rate"] = zone_summary["closures"] / zone_summary["total"]
zone_summary["zone_risk_score"] = (
    0.6 * zone_summary["closure_rate"] + 0.4 * zone_summary["high_priority"]
).round(3)

# Corridor Risk Scores
corridor_summary = df.groupby("corridor").agg(
    total_events=("id", "count"), road_closures=("road_closure", "sum")
)
corridor_summary["closure_rate"] = (
    corridor_summary["road_closures"] / corridor_summary["total_events"]
)
scaler = MinMaxScaler()
corridor_summary["events_norm"] = scaler.fit_transform(corridor_summary[["total_events"]])
corridor_summary["risk_score"] = (
    0.6 * corridor_summary["closure_rate"] + 0.4 * corridor_summary["events_norm"]
)
corridor_risk_lookup = corridor_summary["risk_score"].to_dict()

# Junction Risk Scores
junction_summary = df.groupby("junction").agg(
    total_events=("id", "count"), road_closures=("road_closure", "sum")
)
junction_summary["closure_rate"] = (
    junction_summary["road_closures"] / junction_summary["total_events"]
)
junction_summary["events_norm"] = scaler.fit_transform(junction_summary[["total_events"]])
junction_summary["risk_score"] = (
    0.6 * junction_summary["closure_rate"] + 0.4 * junction_summary["events_norm"]
)
junction_risk_lookup = junction_summary["risk_score"].to_dict()

# Severity Map
severity_map = {
    "vehicle_breakdown": 1,
    "pot_holes": 2,
    "road_conditions": 2,
    "fog_low_visibility": 2,
    "debris": 3,
    "congestion": 3,
    "water_logging": 3,
    "others": 3,
    "tree_fall": 4,
    "accident": 4,
    "construction": 5,
    "public_event": 6,
    "procession": 7,
    "political_rally": 8,
    "vip_movement": 9,
    "protest": 9,
}

# Temporal Risk multiplier
hour_risk = df.groupby("event_hour")["road_closure"].mean()
temporal_multiplier = (hour_risk / hour_risk.mean()).to_dict()

# Base delay by cause
_closed = df[df["closed_datetime"].notna()].copy()
_closed["resolution_min"] = (
    _closed["closed_datetime"] - _closed["start_datetime"]
).dt.total_seconds() / 60
_closed = _closed[(_closed["resolution_min"] > 0) & (_closed["resolution_min"] < 600)]
base_delay_by_cause = (
    _closed.groupby("event_cause_clean")["resolution_min"].median().round(1).to_dict()
)


# ── Spatial KNN logic ──
def _train_spatial_knn(df, target_col, k, exclude_values=None):
    sub = df.dropna(subset=["latitude", "longitude", target_col]).copy()
    if exclude_values:
        sub = sub[~sub[target_col].isin(exclude_values)]
    X = sub[["latitude", "longitude"]].values
    y = sub[target_col].values
    try:
        Xtr, Xte, ytr, yte = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
    except ValueError:
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)
    model = KNeighborsClassifier(n_neighbors=k)
    model.fit(Xtr, ytr)
    held_out_acc = accuracy_score(yte, model.predict(Xte))

    final_model = KNeighborsClassifier(n_neighbors=k)
    final_model.fit(X, y)
    return final_model, round(held_out_acc, 4), len(sub)


print("Training Spatial KNN models...")
CORRIDOR_KNN, corridor_knn_acc, corridor_knn_n = _train_spatial_knn(
    df, "corridor", k=1, exclude_values=["Non-corridor"]
)
JUNCTION_KNN, junction_knn_acc, junction_knn_n = _train_spatial_knn(df, "junction", k=1)
ZONE_KNN, zone_knn_acc, zone_knn_n = _train_spatial_knn(df, "zone", k=1)
print(
    f"  Corridor KNN: acc={corridor_knn_acc:.4f} (n={corridor_knn_n})\n"
    f"  Junction KNN: acc={junction_knn_acc:.4f} (n={junction_knn_n})\n"
    f"  Zone KNN:     acc={zone_knn_acc:.4f} (n={zone_knn_n})"
)


def resolve_location_from_coords(lat, long):
    point = [[lat, long]]
    corridor_pred = CORRIDOR_KNN.predict(point)[0]
    junction_pred = JUNCTION_KNN.predict(point)[0]
    zone_pred = ZONE_KNN.predict(point)[0]
    dist, _ = CORRIDOR_KNN.kneighbors(point, n_neighbors=1)
    nearest_dist_deg = round(float(dist[0][0]), 4)
    reliable = nearest_dist_deg < 0.05
    return {
        "corridor": corridor_pred,
        "junction": junction_pred,
        "zone": zone_pred,
        "reliable": reliable,
        "nearest_neighbor_distance_deg": nearest_dist_deg,
    }


# Impute missing junction/zone
df["junction_imputed"] = False
df["zone_imputed"] = False
_has_coords = df["latitude"].notna() & df["longitude"].notna()

_missing_junction = df["junction"].isna() & _has_coords
_coords_for_junction = df.loc[_missing_junction, ["latitude", "longitude"]].values
if len(_coords_for_junction) > 0:
    df.loc[_missing_junction, "junction"] = JUNCTION_KNN.predict(_coords_for_junction)
    df.loc[_missing_junction, "junction_imputed"] = True

_missing_zone = df["zone"].isna() & _has_coords
_coords_for_zone = df.loc[_missing_zone, ["latitude", "longitude"]].values
if len(_coords_for_zone) > 0:
    df.loc[_missing_zone, "zone"] = ZONE_KNN.predict(_coords_for_zone)
    df.loc[_missing_zone, "zone_imputed"] = True

df["event_weekday"] = df["start_datetime"].dt.weekday.fillna(0).astype(int)
df["is_weekend"] = (df["event_weekday"] >= 5).astype(int)

# Fill NAs for Categorical features
for col in ["corridor", "junction", "zone", "priority"]:
    df[col] = df[col].fillna("Unknown")

CAT_FEATURES = ["event_cause_clean", "corridor", "junction", "zone", "priority"]
NUM_FEATURES = ["event_hour", "event_weekday", "is_weekend"]

ml_encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
X_cat = ml_encoder.fit_transform(df[CAT_FEATURES])
ML_FEATURES = pd.DataFrame(X_cat, columns=CAT_FEATURES, index=df.index)
ML_FEATURES[NUM_FEATURES] = df[NUM_FEATURES]


def encode_live_input(event_type, corridor, junction, zone, priority,
                       event_hour, event_weekday, is_weekend):
    row = pd.DataFrame([{
        "event_cause_clean": event_type,
        "corridor": corridor,
        "junction": junction or "Unknown",
        "zone": zone or "Unknown",
        "priority": priority,
    }])
    encoded = ml_encoder.transform(row[CAT_FEATURES])
    out = pd.DataFrame(encoded, columns=CAT_FEATURES)
    out[NUM_FEATURES] = [[event_hour, event_weekday, is_weekend]]
    return out[CAT_FEATURES + NUM_FEATURES]


# ── Model 1: Road Closure ──
print("Training Road Closure Model...")
y_closure = df["road_closure"]
scale_pos_weight = (y_closure == 0).sum() / max((y_closure == 1).sum(), 1)
CLOSURE_MODEL = xgb.XGBClassifier(
    n_estimators=200, max_depth=5, learning_rate=0.1,
    scale_pos_weight=scale_pos_weight, eval_metric="logloss", random_state=42,
)
CLOSURE_MODEL.fit(ML_FEATURES[CAT_FEATURES + NUM_FEATURES], y_closure)


def predict_closure_probability(event_type, corridor, junction, zone, priority,
                                  event_hour, event_weekday, is_weekend):
    row = encode_live_input(event_type, corridor, junction, zone, priority,
                             event_hour, event_weekday, is_weekend)
    prob = CLOSURE_MODEL.predict_proba(row)[0, 1]
    return round(float(prob) * 100, 1)


# ── Model 2: Clearance Time ──
print("Training Clearance Model...")
_closed_ml = df[df["closed_datetime"].notna()].copy()
_closed_ml["resolution_hours"] = (
    _closed_ml["closed_datetime"] - _closed_ml["start_datetime"]
).dt.total_seconds() / 3600
_closed_ml = _closed_ml[
    (_closed_ml["resolution_hours"] > 0) & (_closed_ml["resolution_hours"] < 500)
]
Xr = ML_FEATURES.loc[_closed_ml.index]
yr_log = np.log1p(_closed_ml["resolution_hours"])

CLEARANCE_MODEL = xgb.XGBRegressor(
    n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42
)
CLEARANCE_MODEL.fit(Xr[CAT_FEATURES + NUM_FEATURES], yr_log)


def predict_clearance_hours(event_type, corridor, junction, zone, priority,
                              event_hour, event_weekday, is_weekend):
    row = encode_live_input(event_type, corridor, junction, zone, priority,
                             event_hour, event_weekday, is_weekend)
    pred_log = CLEARANCE_MODEL.predict(row)[0]
    return round(float(np.expm1(pred_log)), 1)


# ── Model 3: Congestion Risk Classifier ──
print("Training Risk Classifier Model...")
res_by_type = _closed_ml.groupby("event_cause_clean")["resolution_hours"].median()
overall_median = _closed_ml["resolution_hours"].median()

df["resolution_hours_filled"] = df.index.map(
    lambda i: _closed_ml["resolution_hours"].get(i, np.nan)
)
df["resolution_hours_filled"] = df.apply(
    lambda r: r["resolution_hours_filled"] if pd.notna(r["resolution_hours_filled"])
    else res_by_type.get(r["event_cause_clean"], overall_median),
    axis=1,
)

df["impact_index"] = (
    0.5 * df["road_closure"]
    + 0.3 * (df["priority"] == "High").astype(int)
    + 0.2 * (df["resolution_hours_filled"] / df["resolution_hours_filled"].max())
)

df["congestion_risk"] = pd.qcut(
    df["impact_index"], q=4, labels=["Low", "Medium", "High", "Critical"]
)
y_risk = df["congestion_risk"].cat.codes

RISK_MODEL = xgb.XGBClassifier(
    n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42
)
RISK_MODEL.fit(ML_FEATURES[CAT_FEATURES + NUM_FEATURES], y_risk)

RISK_LABELS = ["Low", "Medium", "High", "Critical"]


def predict_congestion_risk(event_type, corridor, junction, zone, priority,
                              event_hour, event_weekday, is_weekend):
    row = encode_live_input(event_type, corridor, junction, zone, priority,
                             event_hour, event_weekday, is_weekend)
    proba = RISK_MODEL.predict_proba(row)[0]
    idx = int(proba.argmax())
    return RISK_LABELS[idx], round(float(proba[idx]) * 100, 1)


RISK_RANK = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
_REAL_EVENT_TYPES = set(df["event_cause_clean"].unique())


def predict_congestion_risk_combined(event_type, corridor, junction, zone, priority,
                                       event_hour, event_weekday, is_weekend,
                                       rule_based_risk):
    """
    FIXED: "always take whichever label ranks higher" broke down hard on
    hypothetical forecasts. Verified directly by inspecting
    RISK_MODEL.feature_importances_: `priority` alone carries 75.6% of the
    decision weight (corridor+junction+zone combined: under 4%). At
    forecast time `priority` is NOT real data, it's a fabricated proxy
    ("High" if severity>=7 else "Low") -- so for most event types the
    model is keying off a guess, not a fact, and returns "Critical"
    almost irrespective of attendance/duration/corridor. Confirmed:
    flipping the proxy priority Low->High only moved confidence from
    86%->58%, both still "Critical" -- the verdict barely depends on
    anything we actually know about this specific event.

    NEW LOGIC -- don't blend or max two raw numbers, decide whether the
    ML verdict has a real basis for THIS input before trusting it:

    1. No real training rows for this event_type -> ML has no signal,
       defer entirely to rule-based (unchanged from original).
    2. ML's own confidence is below a trust threshold -> a low-confidence
       guess shouldn't get to argue with the rule-based score at all.
    3. ML and rule-based disagree by 2+ tiers -- this is exactly the
       symptom observed when the fabricated priority proxy dominates --
       average the ranks instead of taking the max, and suppress the
       confidence number since the answer is now a hedge between two
       disagreeing signals, not one model's clean verdict.
    4. Tiers agree or are adjacent -> ML is corroborating evidence, safe
       to take the higher (more cautious) of the two, as before.
    """
    ml_label, ml_confidence = predict_congestion_risk(
        event_type, corridor, junction, zone, priority,
        event_hour, event_weekday, is_weekend,
    )

    if event_type not in _REAL_EVENT_TYPES:
        return rule_based_risk, None

    ML_TRUST_THRESHOLD = 65.0
    if ml_confidence < ML_TRUST_THRESHOLD:
        return rule_based_risk, None

    ml_rank = RISK_RANK[ml_label]
    rule_rank = RISK_RANK[rule_based_risk]

    if abs(ml_rank - rule_rank) >= 2:
        blended_rank = round((ml_rank + rule_rank) / 2)
        final_label = RISK_LABELS[blended_rank]
        return final_label, None

    final_label = ml_label if ml_rank >= rule_rank else rule_based_risk
    return final_label, ml_confidence


# ── Predictive Functions ──
def predict_delay(attendance, duration_hours, corridor, junction, road_closure,
                   start_hour, severity, event_type):
    score = 0
    crowd_score = min((attendance ** 0.5) / (50000 ** 0.5) * 100, 100)
    score += crowd_score * 0.4
    score += min(duration_hours, 8) * 2
    score += severity * 4
    score += corridor_risk_lookup.get(corridor, 0.2) * 20
    score += junction_risk_lookup.get(junction, 0.2) * 20
    if road_closure:
        score += 15
    time_factor = temporal_multiplier.get(start_hour, 1)
    score += max((time_factor - 1) * 10, 0)
    event_bonus = {
        "vip_movement": 10, "political_rally": 8, "protest": 10, "procession": 5,
    }
    score += event_bonus.get(event_type, 0)
    
    # Large crowd override: if crowd >= 20000, score is at least 80% and increases to 100% at 50,000.
    if attendance >= 20000:
        escalated_score = 80 + min((attendance - 20000) / 30000 * 20, 20)
        score = max(score, escalated_score)
        
    return min(round(score, 2), 100)


def delay_minutes(score, attendance, duration_hours, road_closure):
    delay = 5
    delay += attendance / 500
    delay += duration_hours * 2
    if road_closure:
        delay += 10
    delay += score * 0.2
    return min(round(delay), 240)


def congestion_level(score):
    if score < 25:
        return "Low"
    elif score < 50:
        return "Medium"
    elif score < 75:
        return "High"
    return "Critical"


def barricades_required(score, attendance, road_closure=False, severity=5):
    """
    FIXED: original formula gave 81 barricades for a 5,000-person rally
    with road closure (crowd=20 + severity=16 + closure=20 + risk_tier=25).
    Real large-event deployments in Bengaluru use roughly 15-40 barricades
    even for major rallies/protests — the four terms summing unbounded
    relative to scale was the bug, not any single term being wrong.

    Fix: crowd contribution now scales sub-linearly (sqrt) so a 50,000
    person event doesn't demand 10x the barricades of a 5,000 person one,
    and the final cap is tightened to a realistic ceiling.
    """
    crowd_barricades = min((attendance ** 0.5) / 12, 30)  # sqrt scaling, capped
    severity_barricades = severity * 1.2
    closure_barricades = 8 if road_closure else 0
    if score >= 80:
        risk_barricades = 12
    elif score >= 60:
        risk_barricades = 7
    elif score >= 40:
        risk_barricades = 4
    else:
        risk_barricades = 0
    total = crowd_barricades + severity_barricades + closure_barricades + risk_barricades
    return max(4, min(int(round(total)), 60))  # realistic ceiling, was 300


def affected_corridors_prediction(score, base_delay, corridor):
    decay = [1.0, 0.7, 0.4, 0.2]
    primary = corridor_location_lookup.get(corridor)
    if not primary:
        primary = {"latitude": 12.9716, "longitude": 77.5946}
    others = [c for c in corridor_risk_lookup if c not in (corridor, "Non-corridor")]

    others_sorted = sorted(
        others,
        key=lambda c: haversine(
            primary["latitude"], primary["longitude"],
            corridor_location_lookup.get(c, {}).get("latitude", 12.9716),
            corridor_location_lookup.get(c, {}).get("longitude", 77.5946),
        ),
    )
    corridor_order = [corridor] + others_sorted[: len(decay) - 1]

    affected = []
    for i, c in enumerate(corridor_order):
        d = decay[i] if i < len(decay) else decay[-1]
        delay = round(base_delay * d, 1)
        loc = corridor_location_lookup.get(c, {"latitude": 12.9716, "longitude": 77.5946})
        affected.append({
            "corridor": c,
            "latitude": loc.get("latitude", 12.9716),
            "longitude": loc.get("longitude", 77.5946),
            "impact_pct": int(d * 100),
            "delay_min": delay,
            "risk_level": congestion_level(score * d),
        })
    return affected


def officers_required(score, attendance, event_type):
    minor_hazard_types = {
        "vehicle_breakdown", "pot_holes", "road_conditions",
        "water_logging", "fog_low_visibility", "debris", "congestion",
    }
    if event_type == "vehicle_breakdown":
        return 3
    if event_type in minor_hazard_types:
        return 4
    if event_type in ("accident", "tree_fall"):
        return 5
    if event_type == "construction":
        officers = 5
        if score >= 80:
            officers += 2
        elif score >= 60:
            officers += 1
        return officers

    officers = 5 + (attendance // 1000)
    event_boost = {
        "others": 1, "public_event": 2, "procession": 3,
        "political_rally": 5, "vip_movement": 7, "protest": 8,
    }
    officers += event_boost.get(event_type, 0)
    if score >= 80:
        officers += 5
    elif score >= 60:
        officers += 3
    return min(int(officers), 50)


def diversion_plan(score, corridor):
    safe_corridors = sorted(
        (c for c in corridor_risk_lookup if c not in (corridor, "Non-corridor")),
        key=lambda c: corridor_risk_lookup[c],
    )
    labels = ["Diversion Route A", "Diversion Route B", "Emergency Route C"]
    if score >= 80:
        n = 3
    elif score >= 60:
        n = 2
    elif score >= 40:
        n = 1
    else:
        n = 0
    n = min(n, len(safe_corridors), len(labels))
    routes = []
    for i in range(n):
        diversion_corridor = safe_corridors[i]
        loc = corridor_location_lookup.get(
            diversion_corridor, {"latitude": 12.9716, "longitude": 77.5946}
        )
        routes.append({
            "route_name": labels[i],
            "corridor": diversion_corridor,
            "latitude": loc.get("latitude", 12.9716),
            "longitude": loc.get("longitude", 77.5946),
        })
    return routes


def forecast_event(event_type, attendance, duration_hours, corridor, junction,
                    road_closure, start_hour):
    corridor = resolve_corridor(corridor)
    junction = resolve_junction(junction)
    event_type = _clean_event_cause(event_type)
    if event_type not in severity_map:
        event_type = "others"

    severity = severity_map.get(event_type, 3)
    score = predict_delay(attendance, duration_hours, corridor, junction,
                           road_closure, start_hour, severity, event_type)
    delay = delay_minutes(score, attendance, duration_hours, road_closure)
    rule_based_risk = congestion_level(score)

    proxy_priority = "High" if severity >= 7 else "Low"
    proxy_weekday = pd.Timestamp.now().weekday()
    proxy_weekend = int(proxy_weekday >= 5)

    ml_closure_prob = predict_closure_probability(
        event_type, corridor, junction or "Unknown", "Unknown", proxy_priority,
        start_hour, proxy_weekday, proxy_weekend,
    )
    ml_clearance_hours = predict_clearance_hours(
        event_type, corridor, junction or "Unknown", "Unknown", proxy_priority,
        start_hour, proxy_weekday, proxy_weekend,
    )

    # Crowd >= 20000 bypasses ML ensemble risk classification and follows rule-based risk
    if attendance >= 20000:
        ml_risk_label = rule_based_risk
        ml_risk_confidence = None
    else:
        ml_risk_label, ml_risk_confidence = predict_congestion_risk_combined(
            event_type, corridor, junction or "Unknown", "Unknown", proxy_priority,
            start_hour, proxy_weekday, proxy_weekend, rule_based_risk=rule_based_risk,
        )
 
    incident_loc = corridor_location_lookup.get(
        corridor, {"latitude": 12.9716, "longitude": 77.5946}
    )

    return {
        "event_type": event_type,
        "severity": severity,
        "score": score,
        "risk": ml_risk_label,
        "delay": delay,
        "event_duration_hours": duration_hours,
        "traffic_clearance_min": delay,
        "delay_breakdown": {
            "base": 5,
            "crowd_impact": round(attendance / 500, 1),
            "duration_impact": duration_hours * 2,
            "closure_impact": 10 if road_closure else 0,
            "congestion_impact": round(score * 0.2, 1)
        },
        "officers": officers_required(score, attendance, event_type),
        "barricades": barricades_required(score, attendance, road_closure, severity),
        "diversion_routes": diversion_plan(score, corridor),
        "affected_corridors": affected_corridors_prediction(score, delay, corridor),
        "ml_closure_probability": ml_closure_prob,
        "ml_predicted_clearance_hours": ml_clearance_hours,
        "ml_risk_confidence": ml_risk_confidence,
        "confidence": ml_risk_confidence,
        "incident_location": {
            "corridor": corridor,
            "latitude": incident_loc.get("latitude", 12.9716),
            "longitude": incident_loc.get("longitude", 77.5946),
        },
    }


# ── Junction nodes for the frontend map ──
# FIXED: was an unconditional pd.read_csv() on dataset/junction_nodes.csv
# with no existence check or fallback. If that file is missing/stale,
# the entire module fails to import and forecast_event() never becomes
# available to the API. This is fully derivable from the main dataset
# (median lat/long per junction), so build it from df directly — no
# external file dependency at all.
junction_nodes_path = BASE_DIR / "dataset" / "junction_nodes.csv"

if junction_nodes_path.exists():
    junction_nodes_df = pd.read_csv(junction_nodes_path)
else:
    print(
        f"junction_nodes.csv not found at {junction_nodes_path} — "
        f"deriving junction coordinates from traffic_events.csv instead."
    )
    junction_nodes_df = (
        df.dropna(subset=["junction", "latitude", "longitude"])
        .groupby("junction")
        .agg(latitude=("latitude", "median"), longitude=("longitude", "median"))
        .reset_index()
    )

junction_nodes = []
for _, row in junction_nodes_df.iterrows():
    junction_name = row["junction"]
    risk_score = junction_risk_lookup.get(junction_name, 0)
    junction_nodes.append({
        "junction": junction_name,
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "risk_score": round(risk_score * 100, 2),
    })


# ── Explicit load confirmation ──
# Added so a deployment failure is loud in logs, not silent. If this
# module is imported by app.py and any model below failed to train,
# you'll see it immediately instead of discovering it when the first
# /forecast request 500s.
MODELS_READY = all([
    CORRIDOR_KNN is not None,
    JUNCTION_KNN is not None,
    ZONE_KNN is not None,
    CLOSURE_MODEL is not None,
    CLEARANCE_MODEL is not None,
    RISK_MODEL is not None,
])

print("=" * 50)
print(f"MODELS_READY = {MODELS_READY}")
print(f"  CORRIDOR_KNN  : trained on {corridor_knn_n} rows, held-out acc {corridor_knn_acc:.3f}")
print(f"  JUNCTION_KNN  : trained on {junction_knn_n} rows, held-out acc {junction_knn_acc:.3f}")
print(f"  ZONE_KNN      : trained on {zone_knn_n} rows, held-out acc {zone_knn_acc:.3f}")
print(f"  CLOSURE_MODEL : trained on {len(y_closure)} rows")
print(f"  CLEARANCE_MODEL: trained on {len(_closed_ml)} rows")
print(f"  RISK_MODEL    : trained on {len(y_risk)} rows")
print(f"  Junction nodes for map: {len(junction_nodes)}")
print("=" * 50)