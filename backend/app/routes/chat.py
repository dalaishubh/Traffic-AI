from fastapi import APIRouter
from app.services.chatbot import bot

router = APIRouter()

@router.post("/chat")
def chat(payload: dict):
    msg = payload.get("message", "")
    if not msg:
        return {"answer": "Please provide an event description or ask a question."}
    
    if msg.strip().lower() in ["reset", "restart", "clear"]:
        bot.reset()
        return {"answer": "Conversation reset."}
        
    response = bot.chat(msg)
    return {"answer": response}