from pymongo import ASCENDING, AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import ServerSelectionTimeoutError

from src.config.config import MONGODB_DB, MONGODB_URI

_client: AsyncMongoClient | None = None


def get_db() -> AsyncDatabase:
    if _client is None:
        raise RuntimeError("Mongo client not initialised")
    return _client[MONGODB_DB]


async def connect() -> None:
    global _client
    if not MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not set in .env")

    # Atlas SRV + TLS. Timeouts fail fast with a readable cause.
    _client = AsyncMongoClient(
        MONGODB_URI,
        uuidRepresentation="standard",
        tz_aware=True,
        serverSelectionTimeoutMS=12_000,
        connectTimeoutMS=12_000,
    )
    try:
        await _client.admin.command("ping")
    except ServerSelectionTimeoutError as exc:
        await disconnect()
        raise RuntimeError(
            "MongoDB Atlas unreachable (server selection timed out). "
            "From this machine TCP to the shard works but TLS handshake fails "
            "(TLSV1_ALERT_INTERNAL_ERROR). That is almost always Atlas Network Access: "
            "Atlas → Network Access → Add IP Address → add your current public IP "
            "(or temporarily 0.0.0.0/0). If you allowlisted while on VPN, allowlist again "
            f"off-VPN. Underlying error: {exc}"
        ) from exc
    await ensure_indexes()


async def disconnect() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


async def ensure_indexes() -> None:
    """Idempotent; Mongo has no schema migrations, so indexes are the contract."""
    db = get_db()
    await db.users.create_index([("user_id", ASCENDING)], unique=True)
    await db.users.create_index([("email", ASCENDING)], unique=True)

    await db.refresh_tokens.create_index([("token_hash", ASCENDING)], unique=True)
    await db.refresh_tokens.create_index([("user_id", ASCENDING)])
    await db.refresh_tokens.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)

    await db.reset_password.create_index([("email", ASCENDING)], unique=True)
    await db.reset_password.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)

    await db.meetings.create_index([("meeting_id", ASCENDING)], unique=True)
    await db.meetings.create_index([("owner_user_id", ASCENDING)])
    await db.meetings.create_index([("livekit_room_name", ASCENDING)], unique=True)

    await db.meet_info.create_index([("meeting_id", ASCENDING)], unique=True)
    await db.meet_info.create_index([("transcript_id", ASCENDING)], unique=True)

    await db.transcripts.create_index([("transcript_id", ASCENDING)], unique=True)
    await db.transcripts.create_index([("meeting_id", ASCENDING)], unique=True)

    # Per-user membership index for "my meetings" (Owner / Joined)
    await db.meeting_logs.create_index(
        [("user_id", ASCENDING), ("meeting_id", ASCENDING)],
        unique=True,
    )
    await db.meeting_logs.create_index([("user_id", ASCENDING), ("last_seen_at", ASCENDING)])

    # Bot IAM sub-accounts (one-time unique_id hash, owner list, TTL)
    await db.agent_accounts.create_index([("agent_account_id", ASCENDING)], unique=True)
    await db.agent_accounts.create_index([("unique_id_hash", ASCENDING)], unique=True)
    await db.agent_accounts.create_index([("owner_user_id", ASCENDING), ("created_at", ASCENDING)])
    await db.agent_accounts.create_index([("expires_at", ASCENDING)])
