from pymongo import ASCENDING, ReturnDocument
from pymongo.asynchronous.collection import AsyncCollection

from src.database.mongo import get_db


def meeting_logs() -> AsyncCollection:
    return get_db().meeting_logs


async def upsert_membership(
    *,
    user_id: str,
    meeting_id: str,
    role: str,
    title: str,
    at,
) -> dict:
    """
    Per-user meeting index. One row per (user_id, meeting_id).
    Owner role is sticky — joining your own room never downgrades to participant.
    """
    existing = await meeting_logs().find_one({"user_id": user_id, "meeting_id": meeting_id})
    if existing:
        updates: dict = {
            "last_seen_at": at,
            "title": title,
        }
        if existing.get("role") != "owner" and role == "owner":
            updates["role"] = "owner"
        # never overwrite owner → participant
        return await meeting_logs().find_one_and_update(
            {"_id": existing["_id"]},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )

    doc = {
        "user_id": user_id,
        "meeting_id": meeting_id,
        "role": role,  # owner | participant
        "title": title,
        "created_at": at,
        "last_seen_at": at,
    }
    await meeting_logs().insert_one(doc)
    return doc


async def list_for_user(user_id: str, *, limit: int = 100) -> list[dict]:
    cursor = (
        meeting_logs()
        .find({"user_id": user_id})
        .sort("last_seen_at", -1)
        .limit(limit)
    )
    return await cursor.to_list(length=limit)


async def get_membership(user_id: str, meeting_id: str) -> dict | None:
    return await meeting_logs().find_one({"user_id": user_id, "meeting_id": meeting_id})
