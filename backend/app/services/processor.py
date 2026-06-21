import numpy as np
import pandas as pd
from math import radians, sin, cos, sqrt, atan2
from sklearn.preprocessing import MinMaxScaler
import re
import difflib
from pathlib import Path
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()
ORS_API_KEY = os.getenv("ORS_API_KEY", "")

# ── Load Dataset ─────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CSV_PATH = BASE_DIR / "dataset" / "traffic_events.csv"
df = pd.read_csv(CSV_PATH)

# Preprocessing
df["start_datetime"] = pd.to_datetime(
    df["start_datetime"],
    format="mixed",
    utc=True,
    errors="coerce"
)
df["event_hour"] = df["start_datetime"].dt.hour
df["road_closure"] = df["requires_road_closure"].astype(int)

# ── Haversine Formula ────────────────────────────────────
def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = (
        sin(dlat/2)**2 +
        cos(radians(lat1)) *
        cos(radians(lat2)) *
        sin(dlon/2)**2
    )
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

# Corridor Location Lookup
corridor_location_lookup = (
    df
    .dropna(subset=["latitude","longitude"])
    .groupby("corridor")
    .agg({
        "latitude":"median",
        "longitude":"median"
    })
    .to_dict("index")
)

# ── Location & event-type resolver ───────────────────────
ALL_CORRIDORS = sorted(df["corridor"].dropna().unique().tolist())
ALL_JUNCTIONS = sorted(df["junction"].dropna().unique().tolist())
ALL_ZONES     = sorted(df["zone"].dropna().unique().tolist())

corridor_list = ALL_CORRIDORS
junction_list = ALL_JUNCTIONS

def _normalize_text(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())

_CORRIDOR_NORM = {_normalize_text(c): c for c in ALL_CORRIDORS}
_JUNCTION_NORM = {_normalize_text(j): j for j in ALL_JUNCTIONS}
_ZONE_NORM     = {_normalize_text(z): z for z in ALL_ZONES}

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

# ── Aggregates ───────────────────────────────────────────
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
corridor_risk_lookup = (
    corridor_summary["risk_score"]
    .to_dict()
)

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
junction_risk_lookup = (
    junction_summary["risk_score"]
    .to_dict()
)

# ── Severity Map ─────────────────────────────────────────
severity_map = {
    "vehicle_breakdown":   1,
    "pot_holes":           2,
    "road_conditions":     2,
    "fog_low_visibility":  2,
    "debris":              3,
    "congestion":          3,
    "water_logging":       3,
    "others":              3,
    "tree_fall":           4,
    "accident":            4,
    "construction":        5,
    "public_event":        6,
    "procession":          7,
    "political_rally":     8,
    "vip_movement":        9,
    "protest":             9,
}

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

# ── Predictive Functions ──────────────────────────────────
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
    # Crowd impact
    score += min(attendance / 1000, 10) * 4
    # Duration impact
    score += min(duration_hours, 8) * 2
    # Event severity
    score += severity * 4
    # Corridor risk
    score += corridor_risk_lookup.get(corridor, 0.2) * 20
    # Junction risk
    score += junction_risk_lookup.get(junction, 0.2) * 20
    # Road closure
    if road_closure:
        score += 15
    # Peak-hour bonus
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

def delay_min(
    score,
    attendance,
    duration_hours,
    road_closure
):
    delay = 5
    delay += attendance / 500
    delay += duration_hours * 2
    if road_closure:
        delay += 10
    delay += score * 0.2
    return min(round(delay), 120)

def congestion_level(score):
    if score < 25:
        return "Low"
    elif score < 50:
        return "Medium"
    elif score < 75:
        return "High"
    return "Critical"

def barricades_required(
    attendance,
    severity,
    road_closure
):
    barricades = 2
    barricades += attendance // 1000
    barricades += severity
    if road_closure:
        barricades += 5
    return min(int(barricades), 40)

def affected_corridors_prediction(score, base_delay, corridor):
    decay = [1.0, 0.7, 0.4, 0.2]
    primary = corridor_location_lookup.get(corridor)
    
    if not primary:
        primary = {"latitude": 12.9716, "longitude": 77.5946}
        
    others = [c for c in corridor_risk_lookup if c not in (corridor, "Non-corridor")]
    
    others_sorted = sorted(
        others,
        key=lambda c: haversine(
            primary["latitude"],
            primary["longitude"],
            corridor_location_lookup.get(c, {}).get("latitude", 12.9716),
            corridor_location_lookup.get(c, {}).get("longitude", 77.5946)
        )
    )
    corridor_order = [corridor] + others_sorted[:len(decay) - 1]

    affected = []
    for i, c in enumerate(corridor_order):
        d = decay[i] if i < len(decay) else decay[-1]
        delay = round(base_delay * d, 1)
        loc = corridor_location_lookup.get(
            c,
            {
                "latitude": 12.9716,
                "longitude": 77.5946
            }
        )

        affected.append({
            "corridor": c,
            "latitude": loc.get("latitude", 12.9716),
            "longitude": loc.get("longitude", 77.5946),
            "impact_pct": int(d * 100),
            "delay_min": delay,
            "risk_level": congestion_level(score * d)
        })
    return affected

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

def diversion_plan(score, corridor):
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
    routes = []

    for i in range(n):
        diversion_corridor = safe_corridors[i]
        loc = corridor_location_lookup.get(
            diversion_corridor,
            {
                "latitude": 12.9716,
                "longitude": 77.5946
            }
        )
        routes.append({
            "route_name": labels[i],
            "corridor": diversion_corridor,
            "latitude": loc.get("latitude", 12.9716),
            "longitude": loc.get("longitude", 77.5946)
        })

    return routes

def forecast_event(event_type, attendance, duration_hours, corridor, junction, road_closure, start_hour):
    corridor = resolve_corridor(corridor)
    junction = resolve_junction(junction)

    event_type = _clean_event_cause(event_type)
    if event_type not in severity_map:
        event_type = "others"

    severity = severity_map.get(event_type, 3)
    score = predict_delay(attendance, duration_hours, corridor, junction, road_closure, start_hour, severity, event_type)
    delay = delay_min(score, attendance, duration_hours, road_closure)

    incident_loc = corridor_location_lookup.get(
        corridor,
        {
            "latitude": 12.9716,
            "longitude": 77.5946
        }
    )
    return {
        "event_type": event_type,
        "severity": severity,
        "score": score,
        "risk": congestion_level(score),
        "event_duration_hours": duration_hours,
        "traffic_clearance_min": delay,
        "officers": officers_required(score, attendance, event_type),
        "barricades": barricades_required(attendance, severity, road_closure),
        "diversion_routes": diversion_plan(score, corridor),
        "affected_corridors": affected_corridors_prediction(score, delay, corridor),
        "incident_location": {
            "corridor": corridor,
            "latitude": incident_loc.get("latitude", 12.9716),
            "longitude": incident_loc.get("longitude", 77.5946)
        },
    }
