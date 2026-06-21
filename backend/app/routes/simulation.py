from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List
from app.services.simulator import run_simulation

router = APIRouter(prefix="/simulate", tags=["simulation"])

class ScenarioItem(BaseModel):
    event_type: str = Field(..., description="Type of event (political_rally, protest, etc.)")
    attendance: int = Field(..., ge=0, description="Expected crowd size")
    duration_hours: int = Field(..., ge=1, le=24, description="Event duration in hours")
    corridor: str = Field(..., description="Corridor location name")
    junction: str = Field(..., description="Junction location name")
    road_closure: bool = Field(False, description="Whether road closure is in effect")
    start_hour: int = Field(..., ge=0, le=23, description="Starting hour of the event")

class SimulationRequest(BaseModel):
    scenarios: List[ScenarioItem]

@router.post("")
def simulate_scenarios(request: SimulationRequest):
    if not request.scenarios:
        raise HTTPException(status_code=400, detail="At least one scenario must be provided for simulation.")
    if len(request.scenarios) > 3:
        raise HTTPException(status_code=400, detail="A maximum of 3 scenarios can be compared side-by-side.")
    
    try:
        scenarios_dict_list = [s.model_dump() for s in request.scenarios]
        results = run_simulation(scenarios_dict_list)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")
