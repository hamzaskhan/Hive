from pymongo.asynchronous.collection import AsyncCollection

from src.database.mongo import get_db


def agent_accounts() -> AsyncCollection:
    return get_db().agent_accounts


async def insert(doc: dict) -> dict:
    await agent_accounts().insert_one(doc)
    return doc


async def get_by_id(agent_account_id: str) -> dict | None:
    return await agent_accounts().find_one({"agent_account_id": agent_account_id})


async def get_by_unique_hash(unique_id_hash: str) -> dict | None:
    return await agent_accounts().find_one({"unique_id_hash": unique_id_hash})


async def list_for_owner(owner_user_id: str) -> list[dict]:
    cursor = (
        agent_accounts()
        .find({"owner_user_id": owner_user_id})
        .sort("created_at", -1)
    )
    return [doc async for doc in cursor]


async def patch(agent_account_id: str, fields: dict) -> dict | None:
    return await agent_accounts().find_one_and_update(
        {"agent_account_id": agent_account_id},
        {"$set": fields},
        return_document=True,
    )


async def delete(agent_account_id: str) -> bool:
    result = await agent_accounts().delete_one({"agent_account_id": agent_account_id})
    return result.deleted_count > 0
