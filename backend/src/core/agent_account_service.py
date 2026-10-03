"""
Bot IAM: humans mint one-time agent sub-accounts for Dots / browser agents.

Not a developer API surface — agents log into a plain portal with unique_id + secret answer.
One wrong answer deletes the sub-account. Accounts expire after ttl_hours.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import HTTPException, status

from src.config.config import PUBLIC_APP_URL
from src.core.security import (
    create_agent_access_token,
    create_agent_challenge_token,
    decode_agent_challenge_token,
    hash_password,
    hmac_digest,
    new_agent_unique_id,
    utcnow,
    verify_password,
)
from src.helper import agent_accounts_db, meet_info_db, meeting_db
from src.models.agent_account import (
    AgentAccountListResponse,
    AgentAccountPublic,
    AgentAccountStatus,
    AgentMeResponse,
    AgentSessionResponse,
    AgentStartResponse,
    CreateAgentAccountRequest,
    CreateAgentAccountResponse,
)


def _portal_path() -> str:
    return "/agent"


def _portal_url() -> str:
    return f"{PUBLIC_APP_URL.rstrip('/')}{_portal_path()}"


def _normalize_answer(answer: str) -> str:
    return " ".join(answer.strip().lower().split())


def to_public(doc: dict, *, meeting_title: str | None = None) -> AgentAccountPublic:
    return AgentAccountPublic(
        agent_account_id=doc["agent_account_id"],
        meeting_id=doc["meeting_id"],
        meeting_title=meeting_title,
        label=doc["label"],
        secret_question=doc["secret_question"],
        status=AgentAccountStatus(doc.get("status", "pending")),
        expires_at=doc["expires_at"],
        verified_at=doc.get("verified_at"),
        created_at=doc["created_at"],
    )


async def _meeting_title(meeting_id: str) -> str:
    meeting = await meeting_db.get_meeting_by_id(meeting_id)
    if meeting is None:
        return "Meeting"
    return meeting.get("title") or "Meeting"


def _assert_not_expired(doc: dict) -> None:
    expires = doc.get("expires_at")
    if expires is None:
        return
    # Mongo may return naive UTC
    if getattr(expires, "tzinfo", None) is None:
        from datetime import timezone

        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= utcnow():
        raise HTTPException(status.HTTP_410_GONE, "This bot access has expired")


async def create_agent_account(owner: dict, body: CreateAgentAccountRequest) -> CreateAgentAccountResponse:
    meeting = await meeting_db.get_meeting_by_id(body.meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    if meeting["owner_user_id"] != owner["user_id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the meeting owner can invite a bot")

    unique_id = new_agent_unique_id()
    now = utcnow()
    doc = {
        "agent_account_id": str(uuid.uuid4()),
        "owner_user_id": owner["user_id"],
        "meeting_id": body.meeting_id,
        "label": body.label.strip(),
        "secret_question": body.secret_question.strip(),
        "secret_answer_hash": hash_password(_normalize_answer(body.secret_answer)),
        "unique_id_hash": hmac_digest(unique_id),
        "status": AgentAccountStatus.pending.value,
        "expires_at": now + timedelta(hours=body.ttl_hours),
        "verified_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await agent_accounts_db.insert(doc)

    title = meeting.get("title") or "Meeting"
    instructions = (
        f"First read {PUBLIC_APP_URL.rstrip('/')}/AGENTS.md . "
        f"Then open {_portal_url()} . Enter unique ID {unique_id} . "
        f"Answer the secret question exactly once. "
        f"Meeting notes appear as markdown on the page. "
        f"Access expires {doc['expires_at'].isoformat()}. "
        f"One wrong secret answer permanently deletes this bot account."
    )
    return CreateAgentAccountResponse(
        account=to_public(doc, meeting_title=title),
        unique_id=unique_id,
        agent_portal_path=_portal_path(),
        agent_portal_url=_portal_url(),
        instructions=instructions,
    )


async def list_agent_accounts(owner: dict) -> AgentAccountListResponse:
    rows = await agent_accounts_db.list_for_owner(owner["user_id"])
    accounts: list[AgentAccountPublic] = []
    for doc in rows:
        # Soft-mark expired for display
        try:
            _assert_not_expired(doc)
            status_value = doc.get("status", "pending")
        except HTTPException:
            status_value = AgentAccountStatus.expired.value
            if doc.get("status") != AgentAccountStatus.expired.value:
                await agent_accounts_db.patch(
                    doc["agent_account_id"],
                    {"status": AgentAccountStatus.expired.value, "updated_at": utcnow()},
                )
        title = await _meeting_title(doc["meeting_id"])
        accounts.append(
            to_public({**doc, "status": status_value}, meeting_title=title)
        )
    return AgentAccountListResponse(accounts=accounts)


async def revoke_agent_account(owner: dict, agent_account_id: str) -> dict:
    doc = await agent_accounts_db.get_by_id(agent_account_id)
    if doc is None or doc.get("owner_user_id") != owner["user_id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bot account not found")
    await agent_accounts_db.delete(agent_account_id)
    return {"ok": True, "deleted": agent_account_id}


async def start_agent_session(unique_id: str) -> AgentStartResponse:
    doc = await agent_accounts_db.get_by_unique_hash(hmac_digest(unique_id.strip()))
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown unique ID")

    if doc.get("status") == AgentAccountStatus.active.value:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This unique ID was already used. Ask the human for a new bot invite.",
        )
    if doc.get("status") in (
        AgentAccountStatus.burned.value,
        AgentAccountStatus.expired.value,
    ):
        raise HTTPException(status.HTTP_410_GONE, "This bot access is no longer valid")

    _assert_not_expired(doc)

    challenge = create_agent_challenge_token(doc["agent_account_id"])
    title = await _meeting_title(doc["meeting_id"])
    return AgentStartResponse(
        challenge_token=challenge,
        secret_question=doc["secret_question"],
        label=doc["label"],
        meeting_title=title,
        expires_at=doc["expires_at"],
    )


async def verify_agent_session(challenge_token: str, answer: str) -> AgentSessionResponse:
    try:
        payload = decode_agent_challenge_token(challenge_token)
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired challenge") from exc

    agent_account_id = payload["sub"]
    doc = await agent_accounts_db.get_by_id(agent_account_id)
    if doc is None:
        raise HTTPException(
            status.HTTP_410_GONE,
            "Bot account no longer exists (wrong answer may have burned it)",
        )

    if doc.get("status") != AgentAccountStatus.pending.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "This invite is no longer pending")

    try:
        _assert_not_expired(doc)
    except HTTPException:
        await agent_accounts_db.patch(
            agent_account_id,
            {"status": AgentAccountStatus.expired.value, "updated_at": utcnow()},
        )
        raise

    if not verify_password(_normalize_answer(answer), doc["secret_answer_hash"]):
        # One strike: delete the entire sub-account
        await agent_accounts_db.delete(agent_account_id)
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Incorrect answer. Bot account permanently deleted.",
        )

    now = utcnow()
    updated = await agent_accounts_db.patch(
        agent_account_id,
        {
            "status": AgentAccountStatus.active.value,
            "verified_at": now,
            "updated_at": now,
            # Consume invite — unique_id cannot start another session
            "unique_id_hash": f"used:{doc['unique_id_hash']}",
        },
    )
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bot account not found")

    # Session lasts until account expiry (capped)
    expires = updated["expires_at"]
    if getattr(expires, "tzinfo", None) is None:
        from datetime import timezone

        expires = expires.replace(tzinfo=timezone.utc)
    minutes_left = max(1, int((expires - now).total_seconds() // 60))
    token, expires_in = create_agent_access_token(agent_account_id, expires_minutes=minutes_left)
    title = await _meeting_title(updated["meeting_id"])
    return AgentSessionResponse(
        access_token=token,
        expires_in=expires_in,
        agent_account_id=agent_account_id,
        label=updated["label"],
        meeting_id=updated["meeting_id"],
        meeting_title=title,
    )


async def get_agent_me(account: dict) -> AgentMeResponse:
    _assert_not_expired(account)
    title = await _meeting_title(account["meeting_id"])
    return AgentMeResponse(
        agent_account_id=account["agent_account_id"],
        label=account["label"],
        meeting_id=account["meeting_id"],
        meeting_title=title,
        status=AgentAccountStatus(account.get("status", "active")),
        expires_at=account["expires_at"],
    )


async def build_notes_markdown(account: dict) -> str:
    _assert_not_expired(account)
    if account.get("status") != AgentAccountStatus.active.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bot session not verified")

    meeting_id = account["meeting_id"]
    title = await _meeting_title(meeting_id)
    info = await meet_info_db.get_meet_info(meeting_id)
    if info is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meet info not found")

    transcript = await meet_info_db.get_transcript(info["transcript_id"])
    if transcript is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transcript not found")

    summary = (transcript.get("summary") or "").strip() or "_No summary yet._"
    text = (transcript.get("text") or "").strip() or "_No transcript yet._"
    actions = transcript.get("action_items") or []
    action_block = (
        "\n".join(f"- {item}" for item in actions) if actions else "- _None listed._"
    )

    return (
        f"# {title}\n\n"
        f"- Meeting ID: `{meeting_id}`\n"
        f"- Bot: {account.get('label')}\n"
        f"- Transcript status: `{transcript.get('status')}`\n"
        f"- Shared with humans: `{bool(info.get('transcript_shared'))}`\n\n"
        f"## Summary\n\n{summary}\n\n"
        f"## Action items\n\n{action_block}\n\n"
        f"## Transcript\n\n{text}\n"
    )
