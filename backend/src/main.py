import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from src.config.config import CORS_ORIGINS, PUBLIC_APP_URL
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
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(human_v1_router)
app.include_router(agent_v1_router)


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root():
    return f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Hive API</title></head>
<body style="font-family:sans-serif;max-width:36rem;margin:3rem auto;line-height:1.5">
  <h1>Hive API is up</h1>
  <p>This host is the API. The app is separate.</p>
  <p><a href="{PUBLIC_APP_URL}">Open Hive</a></p>
  <p><a href="/docs">API docs</a> · <a href="/health">Health</a></p>
</body>
</html>"""


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}
