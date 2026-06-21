from fastapi import APIRouter

router = APIRouter()

@router.post("/chat")
def chat(payload: dict):

    msg = payload.get("message", "").lower()

    if "vip" in msg:
        return {
            "answer": """
EVENT IMPACT FORECAST

Congestion: 69.53 / 100 [High]
Clearance Time: 23 min
Officers: 15
Barricades: 11

Affected Corridors:
- Mysore Road
- Bellary Road 1
- Tumkur Road

Use Diversion Route A.
"""
        }

    return {
        "answer": "Please provide an event description."
    }