from app.services.traffic_engine import forecast_event

def run_simulation(scenarios: list) -> list:
    """
    Runs traffic simulation for a list of scenarios.
    Each scenario is processed using the core ML forecast_event logic.
    """
    results = []
    for s in scenarios:
        res = forecast_event(
            event_type=s.get("event_type", "public_event"),
            attendance=int(s.get("attendance", 1000)),
            duration_hours=int(s.get("duration_hours", 2)),
            corridor=s.get("corridor", "CBD 1"),
            junction=s.get("junction", "MG Road"),
            road_closure=bool(s.get("road_closure", False)),
            start_hour=int(s.get("start_hour", 12))
        )
        # Include a reference copy of the input scenario details in the result
        res["input_scenario"] = s
        results.append(res)
    return results
