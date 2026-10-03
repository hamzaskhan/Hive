from pymongo.asynchronous.collection import AsyncCollection

from src.database.mongo import get_db


def meetings() -> AsyncCollection:
    return get_db().meetings


async def insert_meeting(doc: dict) -> dict:
    await meetings().insert_one(doc)
    return doc


async def get_meeting_by_id(meeting_id: str) -> dict | None:
    return await meetings().find_one({"meeting_id": meeting_id})


async def list_meetings_for_owner(owner_user_id: str, *, limit: int = 50) -> list[dict]:
    cursor = (
        meetings()
        .find({"owner_user_id": owner_user_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    return await cursor.to_list(length=limit)


async def set_meeting_status(meeting_id: str, status: str) -> dict | None:
    return await meetings().find_one_and_update(
        {"meeting_id": meeting_id},
        {"$set": {"status": status}},
        return_document=True,
    )
