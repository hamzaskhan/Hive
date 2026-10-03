from fastapi import APIRouter, Depends, status

from src.core import meeting_service
from src.middleware.auth import get_current_user
from src.models.meet_info import (
    MeetInfoPublic,
    ShareTranscriptPreview,
    ShareTranscriptResponse,
    TranscriptPublic,
)
from src.models.meeting import (
    AudioDownloadResponse,
    CreateMeetingRequest,
    CreateMeetingResponse,
    JoinMeetingResponse,
    MeetingListResponse,
    MeetingPublic,
)

router = APIRouter(prefix="/meetings", tags=["human: meetings"])


@router.post("", response_model=CreateMeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(body: CreateMeetingRequest, user: dict = Depends(get_current_user)):
    """Create a LiveKit room. meeting_id is the shareable room address (/m/{id})."""
    return await meeting_service.create_meeting(user, body)


@router.get("/mine", response_model=MeetingListResponse)
async def list_my_meetings(user: dict = Depends(get_current_user)):
    """All meetings for the current user from meeting_logs, tagged Owner or Joined."""
    return await meeting_service.list_my_meetings(user)


@router.get("/{meeting_id}", response_model=MeetingPublic)
async def get_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    return await meeting_service.get_meeting(meeting_id)


@router.post("/{meeting_id}/join", response_model=JoinMeetingResponse)
async def join_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    """Anyone with the share link joins the same room; membership is logged."""
    return await meeting_service.join_meeting(meeting_id, user)


@router.post("/{meeting_id}/end", response_model=MeetingPublic)
async def end_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    """Owner ends the meeting and stops LiveKit composite egress → S3."""
    return await meeting_service.end_meeting(meeting_id, user)


@router.get("/{meeting_id}/info", response_model=MeetInfoPublic)
async def get_meet_info(meeting_id: str, user: dict = Depends(get_current_user)):
    """In-meet info (participants, transcript id, audio). Members only."""
    return await meeting_service.get_meet_info(meeting_id, user)


@router.get("/{meeting_id}/transcript", response_model=TranscriptPublic)
async def get_transcript(meeting_id: str, user: dict = Depends(get_current_user)):
    """Owner always; participants only after owner shares."""
    return await meeting_service.get_transcript_for_meeting(meeting_id, user)


@router.get("/{meeting_id}/transcript/share", response_model=ShareTranscriptPreview)
async def preview_share_transcript(meeting_id: str, user: dict = Depends(get_current_user)):
    """Owner: open share sheet — participants listed by name + email."""
    return await meeting_service.get_transcript_share_preview(meeting_id, user)


@router.post("/{meeting_id}/transcript/share", response_model=ShareTranscriptResponse)
async def share_transcript(meeting_id: str, user: dict = Depends(get_current_user)):
    """Owner: grant all joined participants read access to the transcript."""
    return await meeting_service.share_transcript_with_participants(meeting_id, user)


@router.get("/{meeting_id}/audio/download", response_model=AudioDownloadResponse)
async def download_audio(meeting_id: str, user: dict = Depends(get_current_user)):
    """Owner-only download link for the S3 recording stored on meet_info."""
    return await meeting_service.get_audio_download(meeting_id, user)


@router.post("/{meeting_id}/summarize", response_model=TranscriptPublic)
async def summarize_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    """Owner: Gemini multimodal audio → transcript + summary on transcripts collection."""
    return await meeting_service.summarize_meeting_audio(meeting_id, user)
