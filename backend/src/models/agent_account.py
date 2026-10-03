from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AgentAccountStatus(str, Enum):
    pending = "pending"  # unique id issued, not yet verified
    active = "active"  # secret answered correctly
    expired = "expired"
    burned = "burned"  # wrong answer / revoked


class CreateAgentAccountRequest(BaseModel):
    meeting_id: str
    label: str = Field(min_length=1, max_length=80, examples=["Research Dot"])
    secret_question: str = Field(min_length=3, max_length=240)
    secret_answer: str = Field(min_length=1, max_length=240)
    ttl_hours: int = Field(default=24, ge=1, le=168)


class AgentAccountPublic(BaseModel):
    agent_account_id: str
    meeting_id: str
    meeting_title: str | None = None
    label: str
    secret_question: str
    status: AgentAccountStatus
    expires_at: datetime
    verified_at: datetime | None = None
    created_at: datetime


class CreateAgentAccountResponse(BaseModel):
    """unique_id is shown once — hand it to your Dot / agent."""

    account: AgentAccountPublic
    unique_id: str
    agent_portal_path: str
    agent_portal_url: str
    instructions: str


class AgentAccountListResponse(BaseModel):
    accounts: list[AgentAccountPublic]


class AgentStartRequest(BaseModel):
    unique_id: str = Field(min_length=8, max_length=128)


class AgentStartResponse(BaseModel):
    challenge_token: str
    secret_question: str
    label: str
    meeting_title: str
    expires_at: datetime
    hint: str = "Answer the secret question exactly. One wrong answer permanently deletes this bot access."


class AgentVerifyRequest(BaseModel):
    challenge_token: str
    answer: str = Field(min_length=1, max_length=240)


class AgentSessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    agent_account_id: str
    label: str
    meeting_id: str
    meeting_title: str
    notes_path: str = "/agent/v1/notes.md"


class AgentMeResponse(BaseModel):
    agent_account_id: str
    label: str
    meeting_id: str
    meeting_title: str
    status: AgentAccountStatus
    expires_at: datetime
