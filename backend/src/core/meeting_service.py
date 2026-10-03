import logging
import uuid

from fastapi import HTTPException, status

from src.config.config import PUBLIC_APP_URL
from src.core.security import utcnow
from src.helper import (
    egress_client,
    gemini_client,
    livekit_client,
    meet_info_db,
    meeting_db,
    meeting_logs_db,
    s3_storage,
)
from src.core import user_service
from src.models.meet_info import (
    MeetInfoPublic,
    ShareParticipant,
    ShareTranscriptPreview,
    ShareTranscriptResponse,
    TranscriptPublic,
    TranscriptStatus,
)
from src.models.meeting import (
    AudioDownloadResponse,
    CreateMeetingRequest,
    CreateMeetingResponse,
    JoinMeetingResponse,
    MeetingListItem,
    MeetingListResponse,
    MeetingPublic,
    MeetingStatus,
    MembershipRole,
)

logger = logging.getLogger(__name__)

DEFAULT_MEDIA = {"camera_on": True, "mic_on": True}


def share_path(meeting_id: str) -> str:
    return f"/m/{meeting_id}"


def share_url(meeting_id: str) -> str:
    return f"{PUBLIC_APP_URL.rstrip('/')}{share_path(meeting_id)}"


def to_public(doc: dict) -> MeetingPublic:
    mid = doc["meeting_id"]
    return MeetingPublic(
        meeting_id=mid,
        title=doc["title"],
        owner_user_id=doc["owner_user_id"],
        livekit_room_name=doc["livekit_room_name"],
        status=doc["status"],
        share_path=share_path(mid),
        share_url=share_url(mid),
        defaults=doc.get("defaults", DEFAULT_MEDIA),
        created_at=doc["created_at"],
    )


def meet_info_public(doc: dict) -> MeetInfoPublic:
    return MeetInfoPublic.model_validate(doc)


def transcript_public(doc: dict, *, shared: bool = False) -> TranscriptPublic:
    payload = {**doc, "shared": shared}
    return TranscriptPublic.model_validate(payload)


async def _bootstrap_meet_artifacts(meeting_id: str, now) -> tuple[dict, dict]:
    transcript_id = str(uuid.uuid4())
    transcript = {
        "transcript_id": transcript_id,
        "meeting_id": meeting_id,
        "status": TranscriptStatus.pending.value,
        "text": None,
        "summary": None,
        "action_items": [],
        "segments": [],
        "language": None,
        "created_at": now,
        "updated_at": now,
    }
    await meet_info_db.insert_transcript(transcript)

    info = {
        "meeting_id": meeting_id,
        "transcript_id": transcript_id,
        "audio_s3_url": None,
        "audio_s3_key": None,
        "audio_status": "pending",
        "egress_id": None,
        "participants": [],
        "transcript_shared": False,
        "transcript_shared_at": None,
        "transcript_shared_with": [],
        "created_at": now,
        "updated_at": now,
    }
    await meet_info_db.insert_meet_info(info)
    return info, transcript


async def _share_participants_for_info(info: dict) -> list[ShareParticipant]:
    rows = list(info.get("participants") or [])
    users = await user_service.get_by_ids([p["user_id"] for p in rows if p.get("user_id")])
    out: list[ShareParticipant] = []
    for p in rows:
        uid = p.get("user_id")
        user = users.get(uid) if uid else None
        email = (user or {}).get("email") or "unknown@hive.local"
        name = (user or {}).get("full_name") or p.get("display_name") or email
        out.append(
            ShareParticipant(
                user_id=uid or "",
                display_name=name,
                email=email,
                role=p.get("role") or "participant",
            )
        )
    return out


async def _require_membership(user_id: str, meeting_id: str) -> dict:
    membership = await meeting_logs_db.get_membership(user_id, meeting_id)
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this meeting")
    return membership


async def _ensure_egress_started(meeting: dict) -> None:
    """
    Idempotent: start Room Composite Egress → S3 on first transition to live.
    S3 key includes owner_user_id + meeting_id.
    """
    meeting_id = meeting["meeting_id"]
    info = await meet_info_db.get_meet_info(meeting_id)
    if info is None:
        return
    if info.get("egress_id") or info.get("audio_status") in ("recording", "ready"):
        return

    if not s3_storage.s3_configured():
        await meet_info_db.patch_meet_info(
            meeting_id,
            {"audio_status": "skipped_no_s3"},
        )
        logger.warning("S3 not configured — skipping egress for %s", meeting_id)
        return

    try:
        started = await egress_client.start_room_composite_egress(
            room_name=meeting["livekit_room_name"],
            meeting_id=meeting_id,
            owner_user_id=meeting["owner_user_id"],
        )
    except Exception:
        logger.exception("Failed to start egress for meeting %s", meeting_id)
        await meet_info_db.patch_meet_info(meeting_id, {"audio_status": "failed_start"})
        return

    await meet_info_db.patch_meet_info(
        meeting_id,
        {
            "egress_id": started["egress_id"],
            "audio_s3_key": started["audio_s3_key"],
            "audio_s3_url": started["audio_s3_url"],
            "audio_status": "recording",
        },
    )


async def _finalize_egress(meeting: dict) -> None:
    meeting_id = meeting["meeting_id"]
    info = await meet_info_db.get_meet_info(meeting_id)
    if info is None:
        return

    egress_id = info.get("egress_id")
    key = info.get("audio_s3_key") or s3_storage.recording_key(
        meeting["owner_user_id"], meeting_id, ext="ogg"
    )
    url = info.get("audio_s3_url") or s3_storage.public_https_url(key)

    if not egress_id:
        await meet_info_db.patch_meet_info(
            meeting_id,
            {
                "audio_status": info.get("audio_status") or "skipped",
                "audio_s3_key": key if s3_storage.s3_configured() else None,
                "audio_s3_url": url if s3_storage.s3_configured() else None,
            },
        )
        return

    try:
        stopped = await egress_client.stop_egress(egress_id)
    except Exception:
        logger.exception("Failed to stop egress %s", egress_id)
        await meet_info_db.patch_meet_info(meeting_id, {"audio_status": "failed_stop"})
        return

    # Prefer LiveKit-reported location when present
    location = stopped.get("location") or url
    if stopped.get("filename"):
        # LiveKit may return a full key/path
        key = stopped["filename"]

    ready = False
    if s3_storage.s3_configured():
        try:
            ready = s3_storage.object_exists(key)
        except Exception:
            logger.exception("S3 head_object failed for %s", key)

    await meet_info_db.patch_meet_info(
        meeting_id,
        {
            "audio_s3_key": key,
            "audio_s3_url": location,
            "audio_status": "ready" if (ready or location) else "stopping",
            "egress_error": stopped.get("error"),
        },
    )


async def create_meeting(owner: dict, body: CreateMeetingRequest) -> CreateMeetingResponse:
    meeting_id = str(uuid.uuid4())
    room_name = f"meet_{meeting_id}"
    now = utcnow()

    try:
        await livekit_client.create_room(room_name)
    except Exception as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Failed to create LiveKit room: {exc}",
        ) from exc

    doc = {
        "meeting_id": meeting_id,
        "title": body.title.strip(),
        "owner_user_id": owner["user_id"],
        "livekit_room_name": room_name,
        "status": MeetingStatus.scheduled.value,
        "defaults": DEFAULT_MEDIA,
        "created_at": now,
        "updated_at": now,
    }
    await meeting_db.insert_meeting(doc)
    await _bootstrap_meet_artifacts(meeting_id, now)
    await meeting_logs_db.upsert_membership(
        user_id=owner["user_id"],
        meeting_id=meeting_id,
        role="owner",
        title=doc["title"],
        at=now,
    )

    token = livekit_client.mint_participant_token(
        room_name=room_name,
        identity=owner["user_id"],
        name=owner.get("full_name") or owner["email"],
        is_owner=True,
    )
    return CreateMeetingResponse(
        meeting=to_public(doc),
        livekit_url=livekit_client.client_ws_url(),
        token=token,
    )


async def join_meeting(meeting_id: str, user: dict) -> JoinMeetingResponse:
    doc = await meeting_db.get_meeting_by_id(meeting_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    if doc.get("status") == MeetingStatus.ended.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "Meeting has ended")

    is_owner = doc["owner_user_id"] == user["user_id"]
    role = "owner" if is_owner else "participant"
    now = utcnow()
    became_live = False

    if doc.get("status") == MeetingStatus.scheduled.value:
        await meeting_db.set_meeting_status(meeting_id, MeetingStatus.live.value)
        doc["status"] = MeetingStatus.live.value
        became_live = True

    info = await meet_info_db.get_meet_info(meeting_id)
    if info is None:
        await _bootstrap_meet_artifacts(meeting_id, now)

    await meet_info_db.record_participant_join(
        meeting_id,
        user_id=user["user_id"],
        display_name=user.get("full_name") or user["email"],
        role=role,
        joined_at=now,
    )
    await meeting_logs_db.upsert_membership(
        user_id=user["user_id"],
        meeting_id=meeting_id,
        role=role,
        title=doc["title"],
        at=now,
    )

    # Start composite egress on first live join (idempotent)
    if became_live or doc.get("status") == MeetingStatus.live.value:
        await _ensure_egress_started(doc)

    token = livekit_client.mint_participant_token(
        room_name=doc["livekit_room_name"],
        identity=user["user_id"],
        name=user.get("full_name") or user["email"],
        is_owner=is_owner,
    )
    return JoinMeetingResponse(
        meeting=to_public(doc),
        livekit_url=livekit_client.client_ws_url(),
        token=token,
        role=role,
    )


async def end_meeting(meeting_id: str, user: dict) -> MeetingPublic:
    """Owner ends the meeting: stop egress and mark ended."""
    doc = await meeting_db.get_meeting_by_id(meeting_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    if doc["owner_user_id"] != user["user_id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the meeting owner can end it")
    if doc.get("status") == MeetingStatus.ended.value:
        return to_public(doc)

    await _finalize_egress(doc)
    updated = await meeting_db.set_meeting_status(meeting_id, MeetingStatus.ended.value)
    return to_public(updated or {**doc, "status": MeetingStatus.ended.value})


async def list_my_meetings(user: dict) -> MeetingListResponse:
    logs = await meeting_logs_db.list_for_user(user["user_id"])
    items: list[MeetingListItem] = []
    for log in logs:
        meeting = await meeting_db.get_meeting_by_id(log["meeting_id"])
        if meeting is None:
            continue
        role = MembershipRole(log.get("role", "participant"))
        mid = meeting["meeting_id"]
        items.append(
            MeetingListItem(
                meeting_id=mid,
                title=meeting.get("title") or log.get("title") or "Untitled",
                role=role,
                tag="Owner" if role == MembershipRole.owner else "Joined",
                status=MeetingStatus(meeting.get("status", "scheduled")),
                share_path=share_path(mid),
                share_url=share_url(mid),
                last_seen_at=log.get("last_seen_at") or log.get("created_at"),
                created_at=meeting["created_at"],
            )
        )
    return MeetingListResponse(meetings=items)


async def get_meeting(meeting_id: str) -> MeetingPublic:
    doc = await meeting_db.get_meeting_by_id(meeting_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    return to_public(doc)


async def get_meet_info(meeting_id: str, user: dict) -> MeetInfoPublic:
    await _require_membership(user["user_id"], meeting_id)
    doc = await meet_info_db.get_meet_info(meeting_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meet info not found")
    return meet_info_public(doc)


async def get_transcript_for_meeting(meeting_id: str, user: dict) -> TranscriptPublic:
    """
    Owner can always read. Participants only after the owner shares the transcript.
    """
    meeting = await meeting_db.get_meeting_by_id(meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")

    await _require_membership(user["user_id"], meeting_id)
    info = await meet_info_db.get_meet_info(meeting_id)
    if info is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meet info not found")

    is_owner = meeting["owner_user_id"] == user["user_id"]
    shared = bool(info.get("transcript_shared"))
    if not is_owner and not shared:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Transcript is not shared yet — wait for the meeting owner to share it",
        )

    transcript = await meet_info_db.get_transcript(info["transcript_id"])
    if transcript is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transcript not found")
    return transcript_public(transcript, shared=shared)


async def get_transcript_share_preview(meeting_id: str, user: dict) -> ShareTranscriptPreview:
    """Owner opens Share → see every participant by name + email."""
    meeting = await meeting_db.get_meeting_by_id(meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    if meeting["owner_user_id"] != user["user_id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the meeting owner can share the transcript")

    info = await meet_info_db.get_meet_info(meeting_id)
    if info is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meet info not found")

    transcript = await meet_info_db.get_transcript(info["transcript_id"])
    if transcript is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transcript not found")

    participants = await _share_participants_for_info(info)
    return ShareTranscriptPreview(
        meeting_id=meeting_id,
        transcript_id=info["transcript_id"],
        transcript_status=TranscriptStatus(transcript.get("status", "pending")),
        already_shared=bool(info.get("transcript_shared")),
        shared_at=info.get("transcript_shared_at"),
        participants=participants,
    )


async def share_transcript_with_participants(meeting_id: str, user: dict) -> ShareTranscriptResponse:
    """
    Owner confirms share: all meeting participants (who joined) can GET the transcript.
    How they see it: they are already members via meeting_logs; after this flag flips,
    GET /transcript succeeds for them.
    """
    meeting = await meeting_db.get_meeting_by_id(meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    if meeting["owner_user_id"] != user["user_id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the meeting owner can share the transcript")

    info = await meet_info_db.get_meet_info(meeting_id)
    if info is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meet info not found")

    transcript = await meet_info_db.get_transcript(info["transcript_id"])
    if transcript is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transcript not found")

    participants = await _share_participants_for_info(info)
    now = utcnow()
    shared_with_ids = [p.user_id for p in participants if p.user_id]

    updated_info = await meet_info_db.patch_meet_info(
        meeting_id,
        {
            "transcript_shared": True,
            "transcript_shared_at": now,
            "transcript_shared_with": shared_with_ids,
        },
    )
    if updated_info is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meet info not found")

    return ShareTranscriptResponse(
        meeting_id=meeting_id,
        transcript_id=info["transcript_id"],
        shared=True,
        shared_at=updated_info.get("transcript_shared_at") or now,
        shared_with=participants,
        transcript=transcript_public(transcript, shared=True),
    )


async def get_audio_download(meeting_id: str, user: dict) -> AudioDownloadResponse:
    """Owner-only: return a downloadable URL for the stored recording."""
    meeting = await meeting_db.get_meeting_by_id(meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    if meeting["owner_user_id"] != user["user_id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the meeting owner can download audio")

    info = await meet_info_db.get_meet_info(meeting_id)
    if info is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meet info not found")

    key = info.get("audio_s3_key")
    stored_url = info.get("audio_s3_url")
    if not key and not stored_url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No recording URL stored for this meeting yet")

    filename = (key or f"{meeting_id}-room-composite.ogg").split("/")[-1]

    if key and s3_storage.s3_configured():
        try:
            download_url = s3_storage.presigned_get_url(key, expires_in=3600)
        except Exception as exc:
            if stored_url:
                download_url = stored_url
            else:
                raise HTTPException(
                    status.HTTP_502_BAD_GATEWAY,
                    f"Could not create download link: {exc}",
                ) from exc
    elif stored_url:
        download_url = stored_url
    else:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recording not available")

    return AudioDownloadResponse(
        meeting_id=meeting_id,
        download_url=download_url,
        audio_s3_key=key,
        filename=filename,
    )


async def summarize_meeting_audio(meeting_id: str, user: dict) -> TranscriptPublic:
    """
    Owner: pull S3 recording → Gemini multimodal audio → patch transcripts collection.
    """
    meeting = await meeting_db.get_meeting_by_id(meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    if meeting["owner_user_id"] != user["user_id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the meeting owner can summarize audio")

    if not gemini_client.gemini_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "GEMINI_API_KEY is not set in .env",
        )

    info = await meet_info_db.get_meet_info(meeting_id)
    if info is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meet info not found")

    key = info.get("audio_s3_key")
    if not key:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No audio_s3_key on meet_info — end the meeting after a successful recording first",
        )
    if not s3_storage.s3_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "S3 is not configured")

    transcript_id = info["transcript_id"]
    await meet_info_db.patch_transcript(
        transcript_id,
        {"status": TranscriptStatus.processing.value},
    )

    try:
        audio_bytes = s3_storage.download_bytes(key)
        mime = s3_storage.guess_mime_type(key)
        result = gemini_client.summarize_meeting_audio(audio_bytes, mime_type=mime)
    except Exception as exc:
        logger.exception("Gemini summarize failed for %s", meeting_id)
        await meet_info_db.patch_transcript(
            transcript_id,
            {"status": TranscriptStatus.failed.value},
        )
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Gemini summarization failed: {exc}",
        ) from exc

    updated = await meet_info_db.patch_transcript(
        transcript_id,
        {
            "status": TranscriptStatus.ready.value,
            "text": result["transcript"],
            "summary": result["summary"],
            "action_items": result["action_items"],
            "language": result["language"],
        },
    )
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transcript not found")
    return transcript_public(updated, shared=bool(info.get("transcript_shared")))
