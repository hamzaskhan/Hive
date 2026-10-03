from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class TranscriptStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class ParticipantRecord(BaseModel):
    user_id: str
    display_name: str
    role: str
    joined_at: datetime


class MeetInfoPublic(BaseModel):
    meeting_id: str
    transcript_id: str
    participants: list[ParticipantRecord] = Field(default_factory=list)
    audio_s3_url: str | None = None
    audio_s3_key: str | None = None
    audio_status: str = "pending"
    egress_id: str | None = None
    transcript_shared: bool = False
    transcript_shared_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TranscriptPublic(BaseModel):
    transcript_id: str
    meeting_id: str
    status: TranscriptStatus
    text: str | None = None
    summary: str | None = None
    action_items: list[str] = Field(default_factory=list)
    segments: list[dict] = Field(default_factory=list)
    language: str | None = None
    shared: bool = False
    created_at: datetime
    updated_at: datetime


class ShareParticipant(BaseModel):
    user_id: str
    display_name: str
    email: EmailStr
    role: str


class ShareTranscriptPreview(BaseModel):
    """Owner share sheet: everyone who joined, with emails."""

    meeting_id: str
    transcript_id: str
    transcript_status: TranscriptStatus
    already_shared: bool
    shared_at: datetime | None = None
    participants: list[ShareParticipant] = Field(default_factory=list)


class ShareTranscriptResponse(BaseModel):
    meeting_id: str
    transcript_id: str
    shared: bool
    shared_at: datetime
    shared_with: list[ShareParticipant] = Field(default_factory=list)
    transcript: TranscriptPublic
