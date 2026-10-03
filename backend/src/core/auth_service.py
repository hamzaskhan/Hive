from datetime import timedelta

from fastapi import HTTPException, status

from src.config.config import REFRESH_TOKEN_DAYS
from src.core import user_service
from src.core.security import (
    create_access_token,
    hash_password,
    hmac_digest,
    new_opaque_token,
    password_needs_rehash,
    utcnow,
    verify_password,
)
from src.database.mongo import get_db
from src.models.auth import AuthResponse, LoginRequest, SignupRequest, TokenPair

INVALID_CREDENTIALS = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")


async def issue_tokens(user_id: str) -> TokenPair:
    access_token, expires_in = create_access_token(user_id)
    refresh_token = new_opaque_token()
    now = utcnow()
    await get_db().refresh_tokens.insert_one(
        {
            "token_hash": hmac_digest(refresh_token),
            "user_id": user_id,
            "created_at": now,
            "expires_at": now + timedelta(days=REFRESH_TOKEN_DAYS),
            "revoked": False,
        }
    )
    return TokenPair(access_token=access_token, refresh_token=refresh_token, expires_in=expires_in)


async def signup(data: SignupRequest) -> AuthResponse:
    user = await user_service.create_user(data)
    tokens = await issue_tokens(user["user_id"])
    return AuthResponse(**tokens.model_dump(), user=user_service.to_public(user))


async def login(data: LoginRequest) -> AuthResponse:
    user = await user_service.get_by_email(data.email)
    if user is None or not user.get("is_active", True):
        raise INVALID_CREDENTIALS
    if not verify_password(data.password, user["password_hash"]):
        raise INVALID_CREDENTIALS

    updates: dict = {"last_login_at": utcnow()}
    if password_needs_rehash(user["password_hash"]):
        updates["password_hash"] = hash_password(data.password)
    await get_db().users.update_one({"user_id": user["user_id"]}, {"$set": updates})

    tokens = await issue_tokens(user["user_id"])
    return AuthResponse(**tokens.model_dump(), user=user_service.to_public(user))


async def refresh(refresh_token: str) -> TokenPair:
    """Rotates: the presented refresh token is revoked and a new pair is issued."""
    db = get_db()
    token_hash = hmac_digest(refresh_token)
    record = await db.refresh_tokens.find_one_and_update(
        {"token_hash": token_hash, "revoked": False, "expires_at": {"$gt": utcnow()}},
        {"$set": {"revoked": True, "revoked_at": utcnow()}},
    )
    if record is None:
        reused = await db.refresh_tokens.find_one({"token_hash": token_hash, "revoked": True})
        if reused:
            # A revoked token being replayed means it leaked; kill every session for that user
            await revoke_all(reused["user_id"])
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    return await issue_tokens(record["user_id"])


async def logout(refresh_token: str) -> None:
    await get_db().refresh_tokens.update_one(
        {"token_hash": hmac_digest(refresh_token)},
        {"$set": {"revoked": True, "revoked_at": utcnow()}},
    )


async def revoke_all(user_id: str) -> None:
    await get_db().refresh_tokens.update_many(
        {"user_id": user_id, "revoked": False},
        {"$set": {"revoked": True, "revoked_at": utcnow()}},
    )
