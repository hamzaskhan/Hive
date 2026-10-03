from fastapi import APIRouter, Depends, Response

from src.core import agent_account_service
from src.middleware.agent_auth import get_current_agent
from src.models.agent_account import (
    AgentMeResponse,
    AgentSessionResponse,
    AgentStartRequest,
    AgentStartResponse,
    AgentVerifyRequest,
)

router = APIRouter(tags=["agent: portal"])


@router.post("/session/start", response_model=AgentStartResponse)
async def start_session(body: AgentStartRequest):
    """Step 1 — agent submits one-time unique ID; receives secret question."""
    return await agent_account_service.start_agent_session(body.unique_id)


@router.post("/session/verify", response_model=AgentSessionResponse)
async def verify_session(body: AgentVerifyRequest):
    """
    Step 2 — answer secret question.
    One incorrect answer permanently deletes the bot sub-account.
    """
    return await agent_account_service.verify_agent_session(body.challenge_token, body.answer)


@router.get("/me", response_model=AgentMeResponse)
async def me(account: dict = Depends(get_current_agent)):
    return await agent_account_service.get_agent_me(account)


@router.get("/notes.md")
async def notes_markdown(account: dict = Depends(get_current_agent)):
    """AI-friendly meeting notes as markdown (summary + actions + transcript)."""
    md = await agent_account_service.build_notes_markdown(account)
    return Response(
        content=md,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'inline; filename="hive-notes-{account["meeting_id"]}.md"'
        },
    )
