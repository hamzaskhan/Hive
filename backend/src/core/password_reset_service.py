from datetime import timedelta

from fastapi import HTTPException, status

from src.config.config import OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES, OTP_EMAIL, OTP_EMAIL_APP_PASSWORD
from src.core import auth_service, user_service
from src.core.security import hash_password, hmac_digest, hmac_matches, new_opaque_token, new_otp, utcnow
from src.database.mongo import get_db
from src.helper.email import send_otp_email

INVALID_OTP = HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")


async def pre_forget_password(email: str) -> None:
    """Silently does nothing for unknown emails so the endpoint can't be used to probe accounts."""
    if not (OTP_EMAIL and OTP_EMAIL_APP_PASSWORD):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "OTP email is not configured. Set OTP_EMAIL and OTP_EMAIL_APP_PASSWORD in .env",
        )

    email = email.lower()
    user = await user_service.get_by_email(email)
    if user is None:
        return

    otp = new_otp()
    now = utcnow()
    await get_db().reset_password.replace_one(
        {"email": email},
        {
            "email": email,
            "user_id": user["user_id"],
            "otp_hash": hmac_digest(otp),
            "otp_verified": False,
            "attempts": 0,
            "reset_token_hash": None,
            "created_at": now,
            "expires_at": now + timedelta(minutes=OTP_TTL_MINUTES),
        },
        upsert=True,
    )
    try:
        await send_otp_email(email, otp)
    except Exception as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Could not send the reset code. Check the Gmail app password.",
        ) from exc


async def verify_otp(email: str, otp: str) -> str:
    db = get_db()
    email = email.lower()
    record = await db.reset_password.find_one({"email": email, "expires_at": {"$gt": utcnow()}})
    if record is None or record["attempts"] >= OTP_MAX_ATTEMPTS:
        raise INVALID_OTP

    if not hmac_matches(otp, record["otp_hash"]):
        await db.reset_password.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        raise INVALID_OTP

    reset_token = new_opaque_token()
    await db.reset_password.update_one(
        {"_id": record["_id"]},
        {"$set": {"otp_verified": True, "reset_token_hash": hmac_digest(reset_token)}},
    )
    return reset_token


async def reset_password(reset_token: str, new_password: str) -> None:
    db = get_db()
    record = await db.reset_password.find_one_and_delete(
        {
            "reset_token_hash": hmac_digest(reset_token),
            "otp_verified": True,
            "expires_at": {"$gt": utcnow()},
        }
    )
    if record is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code not verified or reset session expired")

    await db.users.update_one(
        {"user_id": record["user_id"]},
        {"$set": {"password_hash": hash_password(new_password), "updated_at": utcnow()}},
    )
    await auth_service.revoke_all(record["user_id"])
