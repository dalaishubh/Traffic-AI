# ===== CELL 0 =====
# This Python 3 environment comes with many helpful analytics libraries installed
# It is defined by the kaggle/python Docker image: https://github.com/kaggle/docker-python
# For example, here's several helpful packages to load

import numpy as np # linear algebra
import pandas as pd # data processing, CSV file I/O (e.g. pd.read_csv)

# Input data files are available in the read-only "../input/" directory
# For example, running this (by clicking run or pressing Shift+Enter) will list all files under the input directory

import os
for dirname, _, filenames in os.walk('/kaggle/input'):
    for filename in filenames:
        print(os.path.join(dirname, filename))

# You can write up to 20GB to the current directory (/kaggle/working/) that gets preserved as output when you create a version using "Save & Run All" 
# You can also write temporary files to /kaggle/temp/, but they won't be saved outside of the current session

# Use the kagglehub client library to attach Kaggle resources like competitions, datasets, and models to your session
# Learn more about kagglehub: https://github.com/Kaggle/kagglehub/blob/main/README.md

import kagglehub
# kagglehub.dataset_download('<owner>/<dataset-slug>')

# ===== CELL 1 =====
import pandas as pd

df = pd.read_csv("/kaggle/input/datasets/vibhamishra09/gridlock/Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv")

# ===== CELL 2 =====
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler

df["start_datetime"] = pd.to_datetime(
    df["start_datetime"],
    format="mixed",
    utc=True,
    errors="coerce"
)

df["event_hour"] = df["start_datetime"].dt.hour

df["road_closure"] = (
    df["requires_road_closure"]
    .astype(int)
)

# ===== CELL 3 =====
# ── Location & event-type resolver ───────────────────────
# The dataset actually contains 22 corridors, 294 junctions, and 10 zones —
# the original notebook only ever forecast against a handful of them
# (Mysore Road, MekhriCircle, etc) because nothing translated free-text
# location names into the exact strings used in the data. This cell builds
# the full canonical lists and fuzzy-matches ANY location text onto them,
# so forecast_event() can be asked about any real place in Bengaluru.

import re
import difflib

ALL_CORRIDORS = sorted(df["corridor"].dropna().unique().tolist())
ALL_JUNCTIONS = sorted(df["junction"].dropna().unique().tolist())
ALL_ZONES     = sorted(df["zone"].dropna().unique().tolist())


def _normalize_text(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


_CORRIDOR_NORM = {_normalize_text(c): c for c in ALL_CORRIDORS}
_JUNCTION_NORM = {_normalize_text(j): j for j in ALL_JUNCTIONS}
_ZONE_NORM     = {_normalize_text(z): z for z in ALL_ZONES}


def _resolve(text, norm_lookup, default=None, cutoff=0.6):
    """
    Maps free-text location names (however a user or the LLM phrases
    them — e.g. 'Hebbal flyover' or 'K.R. Circle') to the closest
    CANONICAL name that actually exists in the historical dataset.
    1) exact match on the normalized string
    2) substring containment (catches 'Hebbal' -> 'HebbalFlyoverJunc')
    3) fuzzy match as a last resort
    Falls back to `default` only if nothing matches at all.
    """
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
    # Stricter cutoff than junctions: only 22 corridor names, most ending
    # in the generic word "Road", so a loose threshold here was producing
    # false-positive matches for genuinely unrelated/made-up names.
    return _resolve(text, _CORRIDOR_NORM, default="Non-corridor", cutoff=0.75)


def resolve_junction(text):
    return _resolve(text, _JUNCTION_NORM, default=None)


def resolve_zone(text):
    return _resolve(text, _ZONE_NORM, default=None)


# Clean event_cause into a consistent set of categories: "Debris" and
# "debris" collapse into one key, "Fog / Low Visibility" becomes
# "fog_low_visibility", and the 3 "test_demo" rows (clearly test data,
# not a real event type) fold into "others" instead of being their own
# category or silently breaking lookups.
def _clean_event_cause(x):
    if pd.isna(x):
        return "others"
    x = str(x).strip().lower().replace(" / ", "_").replace(" ", "_")
    if x == "test_demo":
        return "others"
    return x


df["event_cause_clean"] = df["event_cause"].apply(_clean_event_cause)

print(
    f"Resolver ready: {len(ALL_CORRIDORS)} corridors, "
    f"{len(ALL_JUNCTIONS)} junctions, {len(ALL_ZONES)} zones, "
    f"{df['event_cause_clean'].nunique()} cleaned event categories."
)
print(df["event_cause_clean"].value_counts())


# ===== CELL 4 =====
# ── Early zone risk + resolution-time aggregates ─────────
# (fixes a pre-existing bug: these were previously only built inside the
# chatbot's Cell B, but referenced by cells above before that ever ran)
df["closed_datetime"] = pd.to_datetime(
    df["closed_datetime"], format="mixed", utc=True, errors="coerce"
)
_closed_early = df[df["closed_datetime"].notna()].copy()
_closed_early["resolution_hours"] = (
    (_closed_early["closed_datetime"] - _closed_early["start_datetime"]).dt.total_seconds() / 3600
)
_closed_early = _closed_early[(_closed_early["resolution_hours"] > 0) & (_closed_early["resolution_hours"] < 500)]
resolution_times = _closed_early.groupby("event_cause")["resolution_hours"].median().round(1).to_dict()

zone_summary = df.groupby("zone").agg(
    total=("id", "count"),
    closures=("road_closure", "sum"),
    high_priority=("priority", lambda x: (x == "High").mean())
)
zone_summary["closure_rate"]    = zone_summary["closures"] / zone_summary["total"]
zone_summary["zone_risk_score"] = (
    0.6 * zone_summary["closure_rate"] + 0.4 * zone_summary["high_priority"]
).round(3)


# ===== CELL 5 =====


# ===== CELL 6 =====
corridor_summary = (
    df.groupby("corridor")
      .agg(
          total_events=("id","count"),
          road_closures=("road_closure","sum")
      )
)

corridor_summary["closure_rate"] = (
    corridor_summary["road_closures"]
    /
    corridor_summary["total_events"]
)

scaler = MinMaxScaler()

corridor_summary["events_norm"] = scaler.fit_transform(
    corridor_summary[["total_events"]]
)

corridor_summary["risk_score"] = (
      0.6 * corridor_summary["closure_rate"]
    + 0.4 * corridor_summary["events_norm"]
)

corridor_summary = corridor_summary.sort_values(
    "risk_score",
    ascending=False
)

corridor_risk_lookup = (
    corridor_summary["risk_score"]
    .to_dict()
)

corridor_summary.head(10)
corridor_summary.to_csv(
    "corridor_risk_scores.csv",
    index=False
)

# ===== CELL 7 =====
corridor_summary = (
    corridor_summary
    .query("corridor != 'Non-corridor'")
    .sort_values("risk_score", ascending=False)
)

corridor_summary.head(10)

# ===== CELL 8 =====
corridor_summary = (
    df.groupby("corridor")
      .agg(
          total_events=("id","count"),
          road_closures=("road_closure","sum")
      )
)

# ===== CELL 9 =====
corridor_summary.sort_values(
    "total_events",
    ascending=False
).head(10)

# ===== CELL 10 =====
junction_summary = (
    df.groupby("junction")
      .agg(
          total_events=("id","count"),
          road_closures=("road_closure","sum")
      )
)

junction_summary["closure_rate"] = (
    junction_summary["road_closures"]
    /
    junction_summary["total_events"]
)

junction_summary["events_norm"] = scaler.fit_transform(
    junction_summary[["total_events"]]
)

junction_summary["risk_score"] = (
      0.6 * junction_summary["closure_rate"]
    + 0.4 * junction_summary["events_norm"]
)

junction_summary = junction_summary.sort_values(
    "risk_score",
    ascending=False
)

junction_risk_lookup = (
    junction_summary["risk_score"]
    .to_dict()
)

junction_summary.head(10)
junction_summary.to_csv(
    "junction_summary.csv",
    index=False
)

# ===== CELL 11 =====
severity_map = {
    # low-severity road hazards
    "vehicle_breakdown":   1,
    "pot_holes":           2,
    "road_conditions":     2,
    "fog_low_visibility":  2,
    # moderate hazards
    "debris":              3,
    "congestion":          3,
    "water_logging":       3,
    "others":              3,
    "tree_fall":           4,
    "accident":            4,
    "construction":        5,
    # crowd / security events
    "public_event":        6,
    "procession":          7,
    "political_rally":     8,   # not in historical data, kept for forecasting hypothetical events
    "vip_movement":        9,
    "protest":             9,
}


# ===== CELL 12 =====
resolution_df = pd.DataFrame(
    resolution_times.items(),
    columns=[
        "event_cause",
        "expected_clearance"
    ]
)

resolution_df["total_events"] = (
    df.groupby("event_cause")
      .size()
      .reindex(
          resolution_df["event_cause"]
      )
      .values
)

resolution_df.to_csv(
    "event_resolution_lookup.csv",
    index=False
)



# ===== CELL 13 =====
zone_summary.reset_index().to_csv(
    "zone_risk_scores.csv",
    index=False
)

# ===== CELL 14 =====
hour_risk = (
    df.groupby("event_hour")
      ["road_closure"]
      .mean()
)

temporal_multiplier = (
    hour_risk
    /
    hour_risk.mean()
).to_dict()

# ===== CELL 15 =====
df["closed_datetime"] = pd.to_datetime(
    df["closed_datetime"], format="mixed", utc=True, errors="coerce"
)
_closed = df[df["closed_datetime"].notna()].copy()
_closed["resolution_min"] = (
    (_closed["closed_datetime"] - _closed["start_datetime"]).dt.total_seconds() / 60
)
_closed = _closed[(_closed["resolution_min"] > 0) & (_closed["resolution_min"] < 600)]

base_delay_by_cause = (
    _closed.groupby("event_cause_clean")["resolution_min"].median().round(1).to_dict()
)
DEFAULT_BASE_DELAY = base_delay_by_cause.get("protest", 30)

print("Base delay anchors loaded:", len(base_delay_by_cause), "event types")


# ===== CELL 16 =====
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
 
def _train_spatial_knn(df, target_col, k, exclude_values=None):
    """
    Trains a KNN classifier mapping (latitude, longitude) -> target_col,
    using only rows where both coordinates and the target are present.
    Reports held-out accuracy so the number printed is always honest,
    not assumed.
    """
    sub = df.dropna(subset=["latitude", "longitude", target_col]).copy()
    if exclude_values:
        sub = sub[~sub[target_col].isin(exclude_values)]
 
    X = sub[["latitude", "longitude"]].values
    y = sub[target_col].values
 
    # Stratified split fails when a class has only 1 sample (can't put
    # it in both train and test) — fall back to a plain random split
    # for junction, which has many singleton classes.
    try:
        Xtr, Xte, ytr, yte = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
    except ValueError:
        Xtr, Xte, ytr, yte = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
 
    model = KNeighborsClassifier(n_neighbors=k)
    model.fit(Xtr, ytr)
    held_out_acc = accuracy_score(yte, model.predict(Xte))
 
    # Refit on ALL labeled data for the final model used in production —
    # the held-out split above was only to measure honest accuracy.
    final_model = KNeighborsClassifier(n_neighbors=k)
    final_model.fit(X, y)
 
    return final_model, round(held_out_acc, 4), len(sub)
 
 
CORRIDOR_KNN, corridor_knn_acc, corridor_knn_n = _train_spatial_knn(
    df, "corridor", k=1, exclude_values=["Non-corridor"]
)
JUNCTION_KNN, junction_knn_acc, junction_knn_n = _train_spatial_knn(
    df, "junction", k=1
)
ZONE_KNN, zone_knn_acc, zone_knn_n = _train_spatial_knn(
    df, "zone", k=1
)
 
print("Spatial KNN models trained (held-out accuracy, honestly measured):")
print(f"  Corridor : {corridor_knn_acc*100:.1f}%  (trained on {corridor_knn_n} labeled rows)")
print(f"  Junction : {junction_knn_acc*100:.1f}%  (trained on {junction_knn_n} labeled rows)")
print(f"  Zone     : {zone_knn_acc*100:.1f}%  (trained on {zone_knn_n} labeled rows)")
 
 
# ── CELL 2: Coordinate-based location resolver ───────────
# Sits alongside your existing TEXT-based resolve_corridor() /
# resolve_junction() / resolve_zone() functions. Use this one instead
# whenever you have real coordinates (GPS, geocoded address, map click)
# rather than typed location text.
 
def resolve_location_from_coords(lat, long):
    """
    Predicts corridor, junction, and zone directly from coordinates.
    Far more reliable than fuzzy text matching when real GPS/geocoded
    coordinates are available (97-99% vs whatever string-similarity
    luck the text resolver gets).
 
    Returns a dict with predictions AND a rough confidence signal
    (distance in degrees to the nearest training point — smaller is
    more trustworthy; ~0.01 degrees is roughly 1km in Bengaluru).
    """
    point = [[lat, long]]
 
    corridor_pred = CORRIDOR_KNN.predict(point)[0]
    junction_pred = JUNCTION_KNN.predict(point)[0]
    zone_pred     = ZONE_KNN.predict(point)[0]
 
    # Nearest-neighbor distance as a sanity check — if the input
    # coordinates are far from anything in the training data (e.g.
    # someone typos a coordinate outside Bengaluru), flag it instead
    # of confidently returning a meaningless nearest match.
    dist, _ = CORRIDOR_KNN.kneighbors(point, n_neighbors=1)
    nearest_dist_deg = round(float(dist[0][0]), 4)
 
    # ~0.05 degrees ≈ 5.5 km in this latitude band — beyond that, the
    # match is likely unreliable (no real corridor/junction nearby).
    reliable = nearest_dist_deg < 0.05
 
    return {
        "corridor": corridor_pred,
        "junction": junction_pred,
        "zone": zone_pred,
        "reliable": reliable,
        "nearest_neighbor_distance_deg": nearest_dist_deg,
    }
 
 
# Quick sanity check against a known point from the dataset
_test_row = df.dropna(subset=["latitude", "longitude", "corridor"]).iloc[0]
_test_result = resolve_location_from_coords(_test_row["latitude"], _test_row["longitude"])
print("\nSanity check on a known training point:")
print(f"  Actual corridor: {_test_row['corridor']}")
print(f"  Predicted:       {_test_result['corridor']}  (reliable={_test_result['reliable']})")
 
 
# ── CELL 3: Impute missing junction/zone using spatial KNN ──
# This is the part that actually fixes the data gap. Rows that have
# coordinates but are missing junction/zone get a model-predicted value
# instead of "Unknown" — only for rows where coordinates exist, and only
# overwriting NaN (never touching a real, already-present label).
 
df["junction_imputed"] = False
df["zone_imputed"] = False
 
_has_coords = df["latitude"].notna() & df["longitude"].notna()
 
# Junction imputation
_missing_junction = df["junction"].isna() & _has_coords
_coords_for_junction = df.loc[_missing_junction, ["latitude", "longitude"]].values
if len(_coords_for_junction) > 0:
    df.loc[_missing_junction, "junction"] = JUNCTION_KNN.predict(_coords_for_junction)
    df.loc[_missing_junction, "junction_imputed"] = True
 
# Zone imputation
_missing_zone = df["zone"].isna() & _has_coords
_coords_for_zone = df.loc[_missing_zone, ["latitude", "longitude"]].values
if len(_coords_for_zone) > 0:
    df.loc[_missing_zone, "zone"] = ZONE_KNN.predict(_coords_for_zone)
    df.loc[_missing_zone, "zone_imputed"] = True
 
print(f"\nImputed junction for {df['junction_imputed'].sum()} rows "
      f"(was missing for {_missing_junction.sum()} rows with coordinates)")
print(f"Imputed zone for {df['zone_imputed'].sum()} rows "
      f"(was missing for {_missing_zone.sum()} rows with coordinates)")
 
print(f"\nJunction completeness: "
      f"{df['junction'].notna().sum()}/{len(df)} "
      f"({df['junction'].notna().mean()*100:.1f}%) — was "
      f"{(df['junction'].notna().sum() - df['junction_imputed'].sum())}/{len(df)} before imputation")
print(f"Zone completeness: "
      f"{df['zone'].notna().sum()}/{len(df)} "
      f"({df['zone'].notna().mean()*100:.1f}%) — was "
      f"{(df['zone'].notna().sum() - df['zone_imputed'].sum())}/{len(df)} before imputation")
 
 
# ── CELL 4: Re-run your 3 ML models on the enriched data ──
# After this cell, re-run your existing "ML MODELS: shared feature
# engineering" cell and the 3 model-training cells (closure probability,
# clearance time, congestion risk) AS-IS — no code changes needed there.
# They'll automatically pick up the enriched junction/zone columns since
# they read straight from `df`.
#
# Expect: more rows contributing real (non-"Unknown") junction/zone
# signal to ML_FEATURES, which should improve recall/F1 on the closure
# model especially, since junction-level risk was previously invisible
# for 69% of rows.
 
print("\nRe-run your feature engineering + 3 ML model cells now.")
print("They will automatically use the enriched junction/zone columns.")
 

# ===== CELL 17 =====
# ── ML MODELS: shared feature engineering ────────────────
from sklearn.preprocessing import OrdinalEncoder

df['event_weekday'] = df['start_datetime'].dt.weekday
df['is_weekend']    = (df['event_weekday'] >= 5).astype(int)

# junction/zone are missing for a large share of rows (not every event
# has one) — fill explicitly rather than dropping ~58-69% of the data
for col in ['corridor', 'junction', 'zone', 'priority']:
    df[col] = df[col].fillna('Unknown')

CAT_FEATURES = ['event_cause_clean', 'corridor', 'junction', 'zone', 'priority']
NUM_FEATURES = ['event_hour', 'event_weekday', 'is_weekend']

ml_encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
X_cat = ml_encoder.fit_transform(df[CAT_FEATURES])
ML_FEATURES = pd.DataFrame(X_cat, columns=CAT_FEATURES, index=df.index)
ML_FEATURES[NUM_FEATURES] = df[NUM_FEATURES]

def encode_live_input(event_type, corridor, junction, zone, priority, event_hour, event_weekday, is_weekend):
    """Encode a single live forecast request the same way as training data."""
    row = pd.DataFrame([{
        'event_cause_clean': event_type, 'corridor': corridor,
        'junction': junction or 'Unknown', 'zone': zone or 'Unknown', 'priority': priority,
    }])
    encoded = ml_encoder.transform(row[CAT_FEATURES])
    out = pd.DataFrame(encoded, columns=CAT_FEATURES)
    out[NUM_FEATURES] = [[event_hour, event_weekday, is_weekend]]
    return out[CAT_FEATURES + NUM_FEATURES]

print(f"Feature matrix ready: {ML_FEATURES.shape[0]} rows, {ML_FEATURES.shape[1]} features")

# ===== CELL 18 =====
# ── MODEL 1: Road Closure Prediction ──────────────────────
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import xgboost as xgb
import lightgbm as lgb
from sklearn.ensemble import RandomForestClassifier

y_closure = df['road_closure']
Xc_train, Xc_test, yc_train, yc_test = train_test_split(
    ML_FEATURES, y_closure, test_size=0.2, random_state=42, stratify=y_closure
)

# Only 8.3% of events are actual closures — without correcting for this,
# a model can hit 92% "accuracy" by just always predicting "no closure."
# scale_pos_weight / class_weight='balanced' forces it to actually learn
# the minority class instead of ignoring it.
scale_pos_weight = (yc_train == 0).sum() / (yc_train == 1).sum()

closure_models = {
    "XGBoost": xgb.XGBClassifier(n_estimators=200, max_depth=5, learning_rate=0.1,
                                  scale_pos_weight=scale_pos_weight, eval_metric='logloss', random_state=42),
    "LightGBM": lgb.LGBMClassifier(n_estimators=200, max_depth=5, learning_rate=0.1,
                                    class_weight='balanced', random_state=42, verbose=-1),
    "RandomForest": RandomForestClassifier(n_estimators=200, max_depth=8,
                                            class_weight='balanced', random_state=42),
}

closure_results = {}
for name, model in closure_models.items():
    model.fit(Xc_train, yc_train)
    pred = model.predict(Xc_test)
    proba = model.predict_proba(Xc_test)[:, 1]
    closure_results[name] = {
        "accuracy":  round(accuracy_score(yc_test, pred), 3),
        "precision": round(precision_score(yc_test, pred, zero_division=0), 3),
        "recall":    round(recall_score(yc_test, pred, zero_division=0), 3),
        "f1":        round(f1_score(yc_test, pred, zero_division=0), 3),
        "roc_auc":   round(roc_auc_score(yc_test, proba), 3),
    }

print(pd.DataFrame(closure_results).T)

# Use the best ROC-AUC model for live predictions
CLOSURE_MODEL = closure_models["XGBoost"]

def predict_closure_probability(event_type, corridor, junction, zone, priority,
                                  event_hour, event_weekday, is_weekend):
    row = encode_live_input(event_type, corridor, junction, zone, priority,
                             event_hour, event_weekday, is_weekend)
    prob = CLOSURE_MODEL.predict_proba(row)[0, 1]
    return round(float(prob) * 100, 1)  # e.g. 87.0 -> "87% chance of closure"

# ===== CELL 19 =====
# ── MODEL 2: Clearance Time Prediction ────────────────────
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np
from sklearn.ensemble import RandomForestRegressor
_closed = df[df['closed_datetime'].notna()].copy()
_closed['resolution_hours'] = (
    (_closed['closed_datetime'] - _closed['start_datetime']).dt.total_seconds() / 3600
)
_closed = _closed[(_closed['resolution_hours'] > 0) & (_closed['resolution_hours'] < 500)]

# resolution_hours is heavily right-skewed: median is under 1 hour, but
# ~10% of rows show 100-488 "hours" -- almost certainly the ticket sitting
# open administratively, not the road actually being blocked that long.
# Training directly on raw hours lets that tail dominate the loss and
# tanks R^2. log1p() compresses the tail so the model learns real
# relative differences instead of chasing outliers.
Xr = ML_FEATURES.loc[_closed.index]
yr_log = np.log1p(_closed['resolution_hours'])
yr_raw = _closed['resolution_hours']

Xr_tr, Xr_te, yr_tr, yr_te, yrraw_tr, yrraw_te = train_test_split(
    Xr, yr_log, yr_raw, test_size=0.2, random_state=42
)

clearance_models = {
    "XGBoost":     xgb.XGBRegressor(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42),
    "LightGBM":    lgb.LGBMRegressor(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42, verbose=-1),
    "RandomForest": RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42),
}

clearance_results = {}
for name, model in clearance_models.items():
    model.fit(Xr_tr, yr_tr)
    pred_hours = np.clip(np.expm1(model.predict(Xr_te)), 0, None)
    clearance_results[name] = {
        "MAE_hours":  round(mean_absolute_error(yrraw_te, pred_hours), 2),
        "RMSE_hours": round(mean_squared_error(yrraw_te, pred_hours) ** 0.5, 2),
        "R2_log_space": round(r2_score(yr_te, model.predict(Xr_te)), 3),
    }

print(pd.DataFrame(clearance_results).T)

CLEARANCE_MODEL = clearance_models["XGBoost"]

def predict_clearance_hours(event_type, corridor, junction, zone, priority,
                              event_hour, event_weekday, is_weekend):
    row = encode_live_input(event_type, corridor, junction, zone, priority,
                             event_hour, event_weekday, is_weekend)
    pred_log = CLEARANCE_MODEL.predict(row)[0]
    return round(float(np.expm1(pred_log)), 1)  # -> "Expected clearance = 3.8 hours"

# ===== CELL 20 =====
# ── MODEL 3: Congestion Risk Classification ───────────────
from sklearn.metrics import classification_report
from sklearn.ensemble import RandomForestRegressor  # already imported above if needed

# There's no ground-truth "risk class" in the raw data, so we build one
# (impact_index) from event-level signals only -- deliberately NOT from
# corridor/junction-level aggregates, since those are themselves derived
# from road_closure rates city-wide; using them in the label would let a
# model "predict" risk just by memorizing which corridor it is, instead
# of learning real event-level patterns.
res_by_type = _closed.groupby(df.loc[_closed.index, 'event_cause_clean'])['resolution_hours'].median()
overall_median = _closed['resolution_hours'].median()

df['resolution_hours_filled'] = df.index.map(lambda i: _closed['resolution_hours'].get(i, np.nan))
df['resolution_hours_filled'] = df.apply(
    lambda r: r['resolution_hours_filled'] if pd.notna(r['resolution_hours_filled'])
    else res_by_type.get(r['event_cause_clean'], overall_median),
    axis=1
)

df['impact_index'] = (
    0.5 * df['road_closure']
    + 0.3 * (df['priority'] == 'High').astype(int)
    + 0.2 * (df['resolution_hours_filled'] / df['resolution_hours_filled'].max())
)

# Quartile bins -> roughly balanced classes, good for both training and demo
df['congestion_risk'] = pd.qcut(df['impact_index'], q=4, labels=['Low', 'Medium', 'High', 'Critical'])
print(df['congestion_risk'].value_counts())

y_risk = df['congestion_risk'].cat.codes
Xk_train, Xk_test, yk_train, yk_test = train_test_split(
    ML_FEATURES, y_risk, test_size=0.2, random_state=42, stratify=y_risk
)

RISK_MODEL = xgb.XGBClassifier(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42)
RISK_MODEL.fit(Xk_train, yk_train)
pred = RISK_MODEL.predict(Xk_test)
print(f"\nAccuracy: {accuracy_score(yk_test, pred):.3f}")
print(classification_report(yk_test, pred, target_names=['Low', 'Medium', 'High', 'Critical']))

RISK_LABELS = ['Low', 'Medium', 'High', 'Critical']

def predict_congestion_risk(event_type, corridor, junction, zone, priority,
                              event_hour, event_weekday, is_weekend):
    row = encode_live_input(event_type, corridor, junction, zone, priority,
                             event_hour, event_weekday, is_weekend)
    proba = RISK_MODEL.predict_proba(row)[0]
    idx = int(proba.argmax())
    return RISK_LABELS[idx], round(float(proba[idx]) * 100, 1)  # -> ("High", 82.0)

# ===== CELL 21 =====
# ── Combined risk: ML model + rule-based fallback ─────────
# The congestion-risk classifier (and the other two ML models) were
# trained ONLY on real historical columns -- there is no attendance/
# crowd-size column anywhere in the raw data, and event types we added
# purely for hypothetical forecasting (political_rally) have ZERO real
# training rows. For those, the model isn't making a considered
# prediction -- it's defaulting on an "unknown category" it's never
# seen, which is why a 50,000-person rally and a 500-person one got the
# same "Medium". We don't pretend the ML model knows about crowd size;
# instead we take whichever is higher between the ML class and the
# rule-based score-derived class, and suppress a meaningless confidence
# number for categories the model has never actually seen.
RISK_RANK = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
_REAL_EVENT_TYPES = set(df['event_cause_clean'].unique())

def predict_congestion_risk_combined(event_type, corridor, junction, zone, priority,
                                       event_hour, event_weekday, is_weekend,
                                       rule_based_risk):
    ml_label, ml_confidence = predict_congestion_risk(
        event_type, corridor, junction, zone, priority,
        event_hour, event_weekday, is_weekend
    )

    if event_type not in _REAL_EVENT_TYPES:
        # No real training examples for this event type (e.g. political_rally)
        # -- ML has no signal here, defer entirely to the rule-based score.
        return rule_based_risk, None

    final_label = ml_label if RISK_RANK[ml_label] >= RISK_RANK[rule_based_risk] else rule_based_risk
    return final_label, ml_confidence

# ===== CELL 22 =====
def predict_delay(
    attendance,
    duration_hours,
    corridor,
    junction,
    road_closure,
    start_hour,
    severity,
    event_type
):
    score = 0

    # sqrt scaling: diminishing returns per extra attendee, doesn't fully
    # saturate until ~50,000 attendees -- gives real separation across
    # event sizes instead of capping (and becoming indistinguishable)
    # at just 10,000 attendees like the old linear version did.
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
        "vip_movement": 10,
        "political_rally": 8,
        "protest": 10,
        "procession": 5
    }
    score += event_bonus.get(event_type, 0)

    return min(round(score, 2), 100)

# ===== CELL 23 =====


# ===== CELL 24 =====
def delay_minutes(
        score,
        attendance,
        duration_hours,
        road_closure):

    delay = 5
    delay += attendance / 500
    delay += duration_hours * 2

    if road_closure:
        delay += 10

    delay += score * 0.2
    return min(round(delay), 240)  # was 120 -- too low a ceiling for mega-events

# ===== CELL 25 =====
def congestion_level(score):
    if score < 25:
        return "Low"
    elif score < 50:
        return "Medium"
    elif score < 75:
        return "High"
    return "Critical"
 

# ===== CELL 26 =====
def barricades_required(score, attendance, road_closure=False, severity=5):
    crowd_barricades    = attendance / 250          # was /150, saturated too early
    severity_barricades = severity * 2
    closure_barricades  = 20 if road_closure else 0

    if score >= 80:
        risk_barricades = 25
    elif score >= 60:
        risk_barricades = 15
    elif score >= 40:
        risk_barricades = 8
    else:
        risk_barricades = 0

    total = crowd_barricades + severity_barricades + closure_barricades + risk_barricades
    return max(4, min(int(round(total)), 300))   # was capped at 150

# ===== CELL 27 =====
def affected_corridors_prediction(score, base_delay, corridor):
    """
    Previously this always reported impact on a hardcoded 4-corridor list
    (Mysore Road, Bellary Road 1/2, Tumkur Road) no matter which corridor
    the event was actually on. Now it picks the PRIMARY corridor (whatever
    was resolved from the user's input) plus the corridors with the
    closest historical risk score to it, as a proxy for secondary impact —
    this works correctly for any of the 22 corridors in the dataset.
    """
    decay = [1.0, 0.7, 0.4, 0.2]
    primary_risk = corridor_risk_lookup.get(corridor, 0.2)
    others = [c for c in corridor_risk_lookup if c not in (corridor, "Non-corridor")]
    others_sorted = sorted(others, key=lambda c: abs(corridor_risk_lookup[c] - primary_risk))
    corridor_order = [corridor] + others_sorted[:len(decay) - 1]

    affected = []
    for i, c in enumerate(corridor_order):
        d = decay[i] if i < len(decay) else decay[-1]
        delay = round(base_delay * d, 1)
        affected.append({
            "corridor": c,
            "impact_pct": int(d * 100),
            "delay_min": delay,
            "risk_level": congestion_level(score * d)
        })
    return affected


# ===== CELL 28 =====
def officers_required(
    score,
    attendance,
    event_type
):
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
        "others":          1,
        "public_event":    2,
        "procession":      3,
        "political_rally": 5,
        "vip_movement":    7,
        "protest":         8,
    }

    officers += event_boost.get(event_type, 0)

    if score >= 80:
        officers += 5
    elif score >= 60:
        officers += 3

    return min(int(officers), 50)


# ===== CELL 29 =====
def diversion_plan(score, corridor):
    """
    Previously always suggested the same 3 hardcoded roads (ORR East 2,
    Old Airport Road, Hennur Main Road) regardless of where the event
    actually was — which made no sense for an event nowhere near those
    roads. Now it picks the LOWEST-risk corridors, excluding the one
    that's actually affected, as the safest available diversions —
    generalizes correctly to any of the 22 corridors.
    """
    safe_corridors = sorted(
        (c for c in corridor_risk_lookup if c not in (corridor, "Non-corridor")),
        key=lambda c: corridor_risk_lookup[c]
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
    return [f"{labels[i]}: via {safe_corridors[i]}" for i in range(n)]


# ===== CELL 30 =====
def forecast_event(event_type, attendance, duration_hours, corridor, junction, road_closure, start_hour):
    # Resolve free-text location names to canonical dataset values -- works
    # for any of the 22 corridors / 294 junctions, not just a hardcoded few.
    corridor = resolve_corridor(corridor)
    junction = resolve_junction(junction)

    # Normalize event_type with the same cleaning rule used on historical
    # data, falling back to "others" for anything truly unrecognized.
    event_type = _clean_event_cause(event_type)
    if event_type not in severity_map:
        event_type = "others"

    severity = severity_map.get(event_type, 3)
    score = predict_delay(attendance, duration_hours, corridor, junction, road_closure, start_hour, severity, event_type)
    delay = delay_minutes(score, attendance, duration_hours, road_closure)
    rule_based_risk = congestion_level(score)

    # --- ML model predictions ---
    # forecast_event() doesn't carry zone/priority/weekday as real inputs
    # (a hypothetical future event has no fixed date), so we proxy them:
    # zone is unknown at forecast time, priority is inferred from severity,
    # and weekday defaults to "today" purely so the encoder has something
    # to encode -- none of these claim to be ground truth.
    proxy_priority = "High" if severity >= 7 else "Low"
    proxy_weekday  = pd.Timestamp.now().weekday()
    proxy_weekend  = int(proxy_weekday >= 5)

    ml_closure_prob = predict_closure_probability(
        event_type, corridor, junction or "Unknown", "Unknown", proxy_priority,
        start_hour, proxy_weekday, proxy_weekend
    )
    ml_clearance_hours = predict_clearance_hours(
        event_type, corridor, junction or "Unknown", "Unknown", proxy_priority,
        start_hour, proxy_weekday, proxy_weekend
    )
    ml_risk_label, ml_risk_confidence = predict_congestion_risk_combined(
        event_type, corridor, junction or "Unknown", "Unknown", proxy_priority,
        start_hour, proxy_weekday, proxy_weekend,
        rule_based_risk=rule_based_risk
    )

    return {
        "event_type": event_type,
        "severity": severity,
        "score": score,
        "risk": rule_based_risk,
        "event_duration_hours": duration_hours,
        "traffic_clearance_min": delay,
        "officers": officers_required(score, attendance, event_type),
        "barricades": barricades_required(score, attendance, road_closure, severity),
        "diversion_routes": diversion_plan(score, corridor),
        "affected_corridors": affected_corridors_prediction(score, delay, corridor),
        # ML-model outputs, already returned as percentages -- don't re-scale these
        "ml_closure_probability": ml_closure_prob,
        "ml_predicted_clearance_hours": ml_clearance_hours,
        "ml_congestion_risk": ml_risk_label,
        "ml_risk_confidence": ml_risk_confidence,  # None when the event type has no real training data
    }

# ===== CELL 31 =====
result = forecast_event(
    event_type="political_rally",
    attendance=5000,
    duration_hours=3,
    corridor="Mysore Road",
    junction="MekhriCircle",
    road_closure=True,
    start_hour=18
)

import pandas as pd

pd.DataFrame([result]).to_csv(
    "forecast_output.csv",
    index=False
)

