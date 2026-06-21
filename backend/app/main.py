from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services import traffic_engine
from app.routes.forecast import router as forecast_router
from app.routes.chat import router as chat_router
from app.routes.simulation import router as simulation_router
from app.routes.timeline import router as timeline_router

app = FastAPI(
    title="Urban Traffic Digital Twin API",
    version="1.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast_router)
app.include_router(chat_router)
app.include_router(simulation_router)
app.include_router(timeline_router)

@app.get("/")
def root():
    return {
        "message": "Urban Traffic Digital Twin API Running"
    }