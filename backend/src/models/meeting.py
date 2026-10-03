from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class MeetingStatus(str, Enum):
    scheduled = "scheduled"
    live = "live"
    ended = "ended"


class MembershipRole(str, Enum):
    owner = "owner"
    participant = "participant"


class CreateMeetingRequest(BaseModel):
    title: str = Field(default="Untitled meeting", min_length=1, max_length=200)


class MeetingPublic(BaseModel):
    meeting_id: str
    title: str
    owner_user_id: str
    livekit_room_name: str
    status: MeetingStatus
    share_path: str
    share_url: str
    defaults: dict
    created_at: datetime


class CreateMeetingResponse(BaseModel):
    meeting: MeetingPublic
    livekit_url: str
    token: str


class JoinMeetingResponse(BaseModel):
    meeting: MeetingPublic
    livekit_url: str
    token: str
    role: str


class MeetingListItem(BaseModel):
    """Row for the user's meeting list — role comes from meeting_logs."""

    meeting_id: str
    title: str
    role: MembershipRole
    tag: str  # "Owner" | "Joined"
    status: MeetingStatus
    share_path: str
    share_url: str
    last_seen_at: datetime
    created_at: datetime


class MeetingListResponse(BaseModel):
    meetings: list[MeetingListItem]


class AudioDownloadResponse(BaseModel):
    meeting_id: str
    download_url: str
    audio_s3_key: str | None = None
    filename: str
