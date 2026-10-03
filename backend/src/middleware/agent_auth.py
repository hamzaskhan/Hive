import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.core.security import decode_agent_access_token, utcnow
from src.helper import agent_accounts_db
from src.models.agent_account import AgentAccountStatus

bearer = HTTPBearer(auto_error=False)


async def get_current_agent(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        payload = decode_agent_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Agent session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid agent token")

    account = await agent_accounts_db.get_by_id(payload["sub"])
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bot account not found")

    if account.get("status") != AgentAccountStatus.active.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bot account is not active")

    expires = account.get("expires_at")
    if expires is not None:
        if getattr(expires, "tzinfo", None) is None:
            from datetime import timezone

            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= utcnow():
            raise HTTPException(status.HTTP_410_GONE, "This bot access has expired")

    return account
