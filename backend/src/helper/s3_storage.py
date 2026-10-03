"""S3 key/URL helpers for meeting recordings.

Object layout (includes meeting_id + owner_user_id as requested):
  {prefix}/{owner_user_id}/{meeting_id}/room-composite.ogg
"""

from __future__ import annotations

import logging

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from src.config.config import (
    AWS_ACCESS_KEY_ID,
    AWS_REGION,
    AWS_SECRET_ACCESS_KEY,
    S3_BUCKET,
    S3_RECORDINGS_PREFIX,
)

logger = logging.getLogger(__name__)


def s3_configured() -> bool:
    return bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and S3_BUCKET)


def recording_key(owner_user_id: str, meeting_id: str, *, ext: str = "ogg") -> str:
    prefix = (S3_RECORDINGS_PREFIX or "hive-recordings").strip("/")
    return f"{prefix}/{owner_user_id}/{meeting_id}/room-composite.{ext}"


def recording_filepath_template(owner_user_id: str, meeting_id: str) -> str:
    """LiveKit filepath without extension — it appends based on file_type."""
    prefix = (S3_RECORDINGS_PREFIX or "hive-recordings").strip("/")
    return f"{prefix}/{owner_user_id}/{meeting_id}/room-composite"


def public_https_url(key: str) -> str:
    return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key.lstrip('/')}"


def s3_uri(key: str) -> str:
    return f"s3://{S3_BUCKET}/{key.lstrip('/')}"


def boto3_client() -> BaseClient:
    if not s3_configured():
        raise RuntimeError("AWS S3 is not configured (AWS_ACCESS_KEY_ID / SECRET / S3_BUCKET)")
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


def download_bytes(key: str) -> bytes:
    """Fetch recording bytes from S3 for Gemini (stays off the request hot path for clients)."""
    client = boto3_client()
    obj = client.get_object(Bucket=S3_BUCKET, Key=key)
    return obj["Body"].read()


def guess_mime_type(key: str) -> str:
    lower = key.lower()
    if lower.endswith(".mp3"):
        return "audio/mpeg"
    if lower.endswith(".mp4") or lower.endswith(".m4a"):
        return "audio/mp4"
    if lower.endswith(".wav"):
        return "audio/wav"
    if lower.endswith(".webm"):
        return "audio/webm"
    return "audio/ogg"


def object_exists(key: str) -> bool:
    client = boto3_client()
    try:
        client.head_object(Bucket=S3_BUCKET, Key=key)
        return True
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            return False
        logger.warning("head_object failed for %s: %s", key, exc)
        return False


def presigned_get_url(key: str, *, expires_in: int = 3600) -> str:
    """Playback URL for private buckets."""
    return boto3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )
