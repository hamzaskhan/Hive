import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.database import mongo
from src.routes.agent.v1 import router as agent_v1_router
from src.routes.human.v1 import router as human_v1_router

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await mongo.connect()
    yield
    await mongo.disconnect()


app = FastAPI(
    title="Fathom for Agents API",
    version="0.1.0",
    description="Meeting platform for humans and AI workers (Dots-style bot IAM). Humans: /human/v1. Agent portal: /agent/v1.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(human_v1_router)
app.include_router(agent_v1_router)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}
