import uuid

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from src.core.security import hash_password, utcnow
from src.database.mongo import get_db
from src.models.auth import SignupRequest
from src.models.user import Onboarding, Preferences, PreferencesUpdate, UserPublic

TERMS_VERSION = "2026-10-03"


def to_public(doc: dict) -> UserPublic:
    return UserPublic.model_validate(doc)


async def create_user(data: SignupRequest) -> dict:
    if not data.accept_terms:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You must accept the terms to sign up")

    now = utcnow()
    doc = {
        "user_id": str(uuid.uuid4()),
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "full_name": data.full_name.strip(),
        "account_type": data.account_type.value,
        "consent": {"terms_version": TERMS_VERSION, "accepted_at": now},
        "preferences": Preferences().model_dump(),
        "onboarding": Onboarding().model_dump(),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "last_login_at": now,
    }
    try:
        await get_db().users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    return doc


async def get_by_email(email: str) -> dict | None:
    return await get_db().users.find_one({"email": email.lower()})


async def get_by_id(user_id: str) -> dict | None:
    return await get_db().users.find_one({"user_id": user_id})


async def get_by_ids(user_ids: list[str]) -> dict[str, dict]:
    if not user_ids:
        return {}
    cursor = get_db().users.find({"user_id": {"$in": user_ids}})
    out: dict[str, dict] = {}
    async for doc in cursor:
        out[doc["user_id"]] = doc
    return out


async def update_preferences(user_id: str, update: PreferencesUpdate) -> dict:
    changes = update.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No preference fields provided")

    set_fields = {f"preferences.{k}": v for k, v in changes.items()}
    set_fields["updated_at"] = utcnow()
    doc = await get_db().users.find_one_and_update(
        {"user_id": user_id},
        {"$set": set_fields},
        return_document=True,
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return doc
