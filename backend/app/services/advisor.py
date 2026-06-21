def generate_strategy(forecast_output: dict) -> dict:
    """
    Generates operational strategy recommendations based on a simulation forecast output.
    """
    score = forecast_output.get("score", 0)
    officers = forecast_output.get("officers", 0)
    barricades = forecast_output.get("barricades", 0)
    diversions = forecast_output.get("diversion_routes", [])

    actions = []
    deployment_plan = []
    num_diversions = len(diversions)

    # Rules Engine
    if score > 80:
        priority = "Critical"
        actions.append(f"Deploy {officers} Officers")
        if num_diversions > 0:
            actions.append(f"Activate {num_diversions} Diversion Routes")
        else:
            actions.append("Activate all diversion routes")
        if barricades > 0:
            actions.append(f"Install {barricades} Barricades")
        actions.append("Issue Public Advisory")
        actions.append("Escalate To Command Center")

        if officers > 0:
            deployment_plan.append(f"Deploy {officers} traffic officers.")
        if barricades > 0:
            deployment_plan.append(f"Install {barricades} temporary barricades.")
        improvement = f"{int(1.5 * score - 114)}%"

    elif score >= 60:
        priority = "High"
        actions.append(f"Deploy {officers} Officers")
        if num_diversions > 0:
            actions.append(f"Activate {num_diversions} Diversion Routes")
        else:
            actions.append("Enable primary diversion")
        if barricades > 0:
            actions.append(f"Install {barricades} Barricades")
        actions.append("Issue Public Advisory")

        if officers > 0:
            deployment_plan.append(f"Deploy {officers} traffic officers.")
        if barricades > 0:
            deployment_plan.append(f"Install {barricades} temporary barricades.")
        improvement = f"{int(score * 0.2)}%"

    elif score >= 40:
        priority = "Medium"
        actions.append(f"Deploy {officers} Officers")
        if barricades > 0:
            actions.append(f"Install {barricades} Barricades")
        actions.append("Monitor secondary corridors")

        if officers > 0:
            deployment_plan.append(f"Deploy {officers} traffic officers.")
        if barricades > 0:
            deployment_plan.append(f"Install {barricades} temporary barricades.")
        improvement = f"{int(score * 0.15)}%"

    else:
        priority = "Low"
        actions.append("Monitor Only")
        deployment_plan.append("No deployment required.")
        improvement = "0%"

    # Diversion intelligence
    primary_route = f"{diversions[0].get('route_name')} - {diversions[0].get('corridor')}" if len(diversions) > 0 else "No active route"
    secondary_route = f"{diversions[1].get('route_name')} - {diversions[1].get('corridor')}" if len(diversions) > 1 else "No secondary route"
    emergency_route = f"{diversions[2].get('route_name')} - {diversions[2].get('corridor')}" if len(diversions) > 2 else ("Inner-loop residential bypass" if score >= 70 else "N/A")

    return {
        "priority": priority,
        "actions": actions,
        "deployment_plan": deployment_plan,
        "estimated_improvement": improvement,
        "diversion": {
            "primary": primary_route,
            "secondary": secondary_route,
            "emergency": emergency_route
        }
    }
