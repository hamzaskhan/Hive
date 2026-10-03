from datetime import timedelta

from livekit import api

from src.config.config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL, LIVEKIT_WEBSOCKET_URL

TOKEN_TTL = timedelta(hours=6)


def _require_livekit_creds() -> None:
    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise RuntimeError(
            "LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set in .env"
        )


def api_http_url() -> str:
    """LiveKitAPI expects an http(s) base URL."""
    _require_livekit_creds()
    url = LIVEKIT_URL.strip().rstrip("/")
    if url.startswith("wss://"):
        return "https://" + url[len("wss://") :]
    if url.startswith("ws://"):
        return "http://" + url[len("ws://") :]
    return url


def client_ws_url() -> str:
    """URL the browser LiveKit client should connect to."""
    _require_livekit_creds()
    if LIVEKIT_WEBSOCKET_URL:
        return LIVEKIT_WEBSOCKET_URL.strip().rstrip("/")
    url = LIVEKIT_URL.strip().rstrip("/")
    if url.startswith("https://"):
        return "wss://" + url[len("https://") :]
    if url.startswith("http://"):
        return "ws://" + url[len("http://") :]
    return url


def livekit_api() -> api.LiveKitAPI:
    return api.LiveKitAPI(api_http_url(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)


async def create_room(room_name: str, *, empty_timeout: int = 60 * 30, max_participants: int = 50) -> api.Room:
    lk = livekit_api()
    try:
        return await lk.room.create_room(
            api.CreateRoomRequest(
                name=room_name,
                empty_timeout=empty_timeout,
                max_participants=max_participants,
            )
        )
    finally:
        await lk.aclose()


def mint_participant_token(
    *,
    room_name: str,
    identity: str,
    name: str,
    is_owner: bool,
) -> str:
    """Mint a short-lived join token. ACL is deferred — everyone can publish cam/mic."""
    _require_livekit_creds()
    grants = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
        can_update_own_metadata=True,
        room_admin=is_owner,
        can_publish_sources=["camera", "microphone", "screen_share", "screen_share_audio"],
    )
    return (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_name(name)
        .with_ttl(TOKEN_TTL)
        .with_grants(grants)
        .with_metadata('{"role":"%s"}' % ("owner" if is_owner else "participant"))
        .to_jwt()
    )
