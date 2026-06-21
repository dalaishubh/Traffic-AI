from fastapi import APIRouter, HTTPException, Query
from app.services.timeline import generate_timeline

router = APIRouter(prefix="/timeline", tags=["timeline"])

@router.get("")
def get_timeline(
    corridor: str = Query(..., description="Name of the corridor"),
    score: float = Query(..., alias="risk_score", description="Predicted congestion/risk score"),
    delay: float = Query(..., alias="delay_minutes", description="Predicted delay clearance in minutes")
):
    try:
        return generate_timeline(corridor, score, delay)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Timeline generation failed: {str(e)}")
