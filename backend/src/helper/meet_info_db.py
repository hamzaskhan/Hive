from pymongo.asynchronous.collection import AsyncCollection

from src.database.mongo import get_db


def meet_info() -> AsyncCollection:
    return get_db().meet_info


def transcripts() -> AsyncCollection:
    return get_db().transcripts


async def insert_meet_info(doc: dict) -> dict:
    await meet_info().insert_one(doc)
    return doc


async def get_meet_info(meeting_id: str) -> dict | None:
    return await meet_info().find_one({"meeting_id": meeting_id})


async def insert_transcript(doc: dict) -> dict:
    await transcripts().insert_one(doc)
    return doc


async def get_transcript(transcript_id: str) -> dict | None:
    return await transcripts().find_one({"transcript_id": transcript_id})


async def record_participant_join(
    meeting_id: str,
    *,
    user_id: str,
    display_name: str,
    role: str,
    joined_at,
) -> dict | None:
    """
    Idempotent join log: first join inserts the participant;
    re-joins only bump last_seen_at so we don't duplicate rows.
    """
    existing = await meet_info().find_one(
        {"meeting_id": meeting_id, "participants.user_id": user_id},
        {"participants.$": 1},
    )
    if existing:
        return await meet_info().find_one_and_update(
            {"meeting_id": meeting_id, "participants.user_id": user_id},
            {"$set": {"participants.$.last_seen_at": joined_at, "updated_at": joined_at}},
            return_document=True,
        )

    return await meet_info().find_one_and_update(
        {"meeting_id": meeting_id},
        {
            "$push": {
                "participants": {
                    "user_id": user_id,
                    "display_name": display_name,
                    "role": role,
                    "joined_at": joined_at,
                    "last_seen_at": joined_at,
                }
            },
            "$set": {"updated_at": joined_at},
        },
        return_document=True,
    )


async def patch_meet_info(meeting_id: str, fields: dict) -> dict | None:
    """Fill placeholder keys later (audio_s3_url, etc.) without recreating the doc."""
    from src.core.security import utcnow

    payload = {**fields, "updated_at": utcnow()}
    return await meet_info().find_one_and_update(
        {"meeting_id": meeting_id},
        {"$set": payload},
        return_document=True,
    )


async def patch_transcript(transcript_id: str, fields: dict) -> dict | None:
    from src.core.security import utcnow

    payload = {**fields, "updated_at": utcnow()}
    return await transcripts().find_one_and_update(
        {"transcript_id": transcript_id},
        {"$set": payload},
        return_document=True,
    )
