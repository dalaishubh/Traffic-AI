# app/models/schemas.py

from pydantic import BaseModel

class ForecastRequest(BaseModel):

    event_type: str
    attendance: int
    duration_hours: float

    corridor: str
    junction: str

    road_closure: bool

    start_hour: int