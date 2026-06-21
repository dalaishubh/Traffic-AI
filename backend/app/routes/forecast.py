from fastapi import APIRouter
from pydantic import BaseModel

from app.models.schemas import ForecastRequest
from app.services.traffic_engine import (
    forecast_event,
    corridor_list,
    junction_list,
    junction_nodes
)
from app.services.advisor import generate_strategy

router = APIRouter()

@router.post("/forecast")
def forecast(data: ForecastRequest):

    result = forecast_event(
        event_type=data.event_type,
        attendance=data.attendance,
        duration_hours=data.duration_hours,
        corridor=data.corridor,
        junction=data.junction,
        road_closure=data.road_closure,
        start_hour=data.start_hour
    )

    # Attach strategy advice
    result["strategy"] = generate_strategy(result)

    return result


@router.get("/corridors")
def get_corridors():
    return corridor_list


@router.get("/junctions")
def get_junctions():
    return junction_list


@router.get("/junctions/live")
def get_live_junctions():
    return junction_nodes


class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
def chat_endpoint(data: ChatRequest):
    from app.services.chatbot import bot
    answer = bot.chat(data.message)
    return {"answer": answer}