from fastapi import APIRouter, Depends

from src.core import agent_account_service
from src.middleware.auth import get_current_user
from src.models.agent_account import (
    AgentAccountListResponse,
    CreateAgentAccountRequest,
    CreateAgentAccountResponse,
)

router = APIRouter(prefix="/agent-accounts", tags=["human: bot IAM"])


@router.post("", response_model=CreateAgentAccountResponse)
async def create_agent_account(
    body: CreateAgentAccountRequest,
    user: dict = Depends(get_current_user),
):
    """
    Mint a one-time bot sub-account for a meeting.
    unique_id is returned once — give it to your Dot / browser agent.
    """
    return await agent_account_service.create_agent_account(user, body)


@router.get("", response_model=AgentAccountListResponse)
async def list_agent_accounts(user: dict = Depends(get_current_user)):
    return await agent_account_service.list_agent_accounts(user)


@router.delete("/{agent_account_id}")
async def revoke_agent_account(agent_account_id: str, user: dict = Depends(get_current_user)):
    return await agent_account_service.revoke_agent_account(user, agent_account_id)
