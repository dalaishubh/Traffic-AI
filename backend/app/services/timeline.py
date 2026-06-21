from app.services.traffic_engine import affected_corridors_prediction

def generate_timeline(corridor: str, score: float, delay: float) -> dict:
    """
    Generates a dynamic event impact timeline based on predicted risk score,
    delay clearance minutes, and affected alternate corridors.
    """
    # 1. Retrieve predicted affected corridors
    affected = affected_corridors_prediction(score, delay, corridor)
    
    timeline = []
    
    # Stage 0: 0 mins - Incident occurs
    timeline.append({
        "minute": 0,
        "title": "Incident Occurs",
        "corridor": corridor,
        "impact_pct": 100,
        "description": f"Initial traffic bottleneck reported on {corridor}."
    })
    
    # Dynamically scale timeline duration based on predicted clearance delay (minimum 60 minutes)
    max_min = max(60, int(round(delay)))
    step_15 = int(round(max_min * 0.25))
    step_30 = int(round(max_min * 0.50))
    step_45 = int(round(max_min * 0.75))
    step_60 = max_min
    
    # Propagation stages
    stages = [
        {"minute": step_15, "title": "Queue Formation", "desc": "Traffic queue building up local delays."},
        {"minute": step_30, "title": "Secondary Impact", "desc": "Alternate corridors start experiencing spillover."},
        {"minute": step_45, "title": "Network Spread", "desc": "Congestion propagating through the wider grid."},
        {"minute": step_60, "title": "Peak Congestion", "desc": "Maximum queue depth reached; active intervention advised."}
    ]
    
    # Sort affected corridors by impact percent descending, excluding primary corridor
    filtered_affected = [a for a in affected if a["corridor"].lower() != corridor.lower()]
    filtered_affected = sorted(filtered_affected, key=lambda x: x["impact_pct"], reverse=True)
    
    # Dynamic scaling based on risk score (0-100 range)
    # Higher score retains higher congestion propagation intensity.
    score_factor = max(0.4, min(1.2, score / 75.0))
    
    base_decays = [0.7, 0.4, 0.2, 0.15]
    
    for i, stage in enumerate(stages):
        # Determine corridor name
        if i < len(filtered_affected):
            corr_name = filtered_affected[i]["corridor"]
        else:
            corr_name = "Adjacent Linkage Roads"
            
        # Dynamically scale decay based on event severity/score
        base_decay = base_decays[i]
        dynamic_pct = int(min(95, max(10, base_decay * score_factor * 100)))
            
        timeline.append({
            "minute": stage["minute"],
            "title": stage["title"],
            "corridor": corr_name,
            "impact_pct": dynamic_pct,
            "description": f"{stage['desc']} Affected: {corr_name}."
        })
        
    # Predict Peak congestion timing and confidence
    peak_minutes = step_45 if delay <= 60 else step_60
    confidence = min(95, max(65, int(75 + (score % 21))))
    
    return {
        "timeline": timeline,
        "peak_congestion_minutes": peak_minutes,
        "confidence_pct": confidence
    }
