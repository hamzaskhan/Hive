"""Gemini multimodal: meeting audio → transcript + summary."""

from __future__ import annotations

import json
import logging
import re

from google import genai
from google.genai import types

from src.config.config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

PROMPT = """You are summarizing a meeting recording for Hive (AI meeting notes).

1) Transcribe the audio as faithfully as you can.
2) Write a concise meeting summary.
3) List action items if any are mentioned.

Return ONLY valid JSON with this shape (no markdown fences):
{
  "transcript": "<full transcript text>",
  "summary": "<1-3 short paragraphs>",
  "action_items": ["...", "..."],
  "language": "en"
}
"""


def gemini_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in .env")
    return genai.Client(api_key=GEMINI_API_KEY)


def _parse_json(text: str) -> dict:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Model sometimes wraps extra prose — grab first {...}
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            return json.loads(match.group(0))
        raise


def summarize_meeting_audio(audio_bytes: bytes, *, mime_type: str = "audio/ogg") -> dict:
    """
    Send audio to Gemini; return {transcript, summary, action_items, language, raw_text}.
    """
    client = _client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            PROMPT,
        ],
    )
    raw_text = (response.text or "").strip()
    try:
        parsed = _parse_json(raw_text)
    except Exception:
        logger.exception("Gemini returned non-JSON; storing raw text as summary")
        parsed = {
            "transcript": raw_text,
            "summary": raw_text,
            "action_items": [],
            "language": "en",
        }

    return {
        "transcript": str(parsed.get("transcript") or ""),
        "summary": str(parsed.get("summary") or ""),
        "action_items": list(parsed.get("action_items") or []),
        "language": str(parsed.get("language") or "en"),
        "raw_text": raw_text,
    }
