import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from src.config.config import (
    ACCESS_TOKEN_MINUTES,
    BCRYPT_ROUNDS,
    JWT_SECRET,
    TOKEN_HMAC_SECRET,
)

JWT_ALGORITHM = "HS256"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def password_needs_rehash(password_hash: str) -> bool:
    """True when the stored hash was made with a different work factor than BCRYPT_ROUNDS."""
    try:
        return int(password_hash.split("$")[2]) != BCRYPT_ROUNDS
    except (IndexError, ValueError):
        return True


def hmac_digest(value: str) -> str:
    return hmac.new(TOKEN_HMAC_SECRET.encode(), value.encode(), hashlib.sha256).hexdigest()


def hmac_matches(value: str, digest: str) -> bool:
    return hmac.compare_digest(hmac_digest(value), digest)


def new_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def new_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def create_access_token(user_id: str) -> tuple[str, int]:
    expires_in = ACCESS_TOKEN_MINUTES * 60
    now = utcnow()
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM), expires_in


def create_agent_access_token(agent_account_id: str, *, expires_minutes: int = 60) -> tuple[str, int]:
    expires_in = max(60, expires_minutes * 60)
    now = utcnow()
    payload = {
        "sub": agent_account_id,
        "type": "agent_access",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM), expires_in


def create_agent_challenge_token(agent_account_id: str, *, expires_minutes: int = 10) -> str:
    now = utcnow()
    payload = {
        "sub": agent_account_id,
        "type": "agent_challenge",
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return payload


def decode_agent_access_token(token: str) -> dict:
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    if payload.get("type") != "agent_access":
        raise jwt.InvalidTokenError("Not an agent access token")
    return payload


def decode_agent_challenge_token(token: str) -> dict:
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    if payload.get("type") != "agent_challenge":
        raise jwt.InvalidTokenError("Not an agent challenge token")
    return payload


def new_agent_unique_id() -> str:
    return f"hive_bot_{secrets.token_urlsafe(18)}"
