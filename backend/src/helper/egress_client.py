"""LiveKit Room Composite Egress → S3 (audio-only for now)."""

from __future__ import annotations

import logging

from livekit import api

from src.config.config import (
    AWS_ACCESS_KEY_ID,
    AWS_REGION,
    AWS_SECRET_ACCESS_KEY,
    S3_BUCKET,
)
from src.helper import livekit_client, s3_storage

logger = logging.getLogger(__name__)


async def start_room_composite_egress(
    *,
    room_name: str,
    meeting_id: str,
    owner_user_id: str,
) -> dict:
    """
    Start LiveKit room composite (audio-only) writing to S3.
    Returns {egress_id, audio_s3_key, audio_s3_url, filepath}.
    """
    if not s3_storage.s3_configured():
        raise RuntimeError("S3 is not configured — set AWS_* and S3_BUCKET in .env")

    filepath = s3_storage.recording_filepath_template(owner_user_id, meeting_id)
    # Final object key once LiveKit appends .ogg
    key = s3_storage.recording_key(owner_user_id, meeting_id, ext="ogg")
    url = s3_storage.public_https_url(key)

    req = api.RoomCompositeEgressRequest(
        room_name=room_name,
        audio_only=True,
        file_outputs=[
            api.EncodedFileOutput(
                file_type=api.EncodedFileType.OGG,
                filepath=filepath,
                s3=api.S3Upload(
                    access_key=AWS_ACCESS_KEY_ID,
                    secret=AWS_SECRET_ACCESS_KEY,
                    region=AWS_REGION,
                    bucket=S3_BUCKET,
                ),
            )
        ],
    )

    lk = livekit_client.livekit_api()
    try:
        info = await lk.egress.start_room_composite_egress(req)
    finally:
        await lk.aclose()

    logger.info(
        "Started egress %s for room %s → s3://%s/%s",
        info.egress_id,
        room_name,
        S3_BUCKET,
        key,
    )
    return {
        "egress_id": info.egress_id,
        "audio_s3_key": key,
        "audio_s3_url": url,
        "filepath": filepath,
        "status": str(info.status),
    }


async def stop_egress(egress_id: str) -> dict:
    """Stop an active egress; returns file location if LiveKit already finalized it."""
    lk = livekit_client.livekit_api()
    try:
        info = await lk.egress.stop_egress(api.StopEgressRequest(egress_id=egress_id))
    finally:
        await lk.aclose()

    location = None
    filename = None
    if info.file_results:
        location = info.file_results[0].location or None
        filename = info.file_results[0].filename or None
    else:
        try:
            if info.HasField("file") and info.file.location:
                location = info.file.location
                filename = info.file.filename
        except ValueError:
            pass

    return {
        "egress_id": info.egress_id,
        "status": str(info.status),
        "error": info.error or None,
        "location": location,
        "filename": filename,
    }
