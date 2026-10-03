import asyncio
import smtplib
from email.message import EmailMessage

from src.config.config import OTP_EMAIL, OTP_EMAIL_APP_PASSWORD, OTP_TTL_MINUTES


def _send(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = OTP_EMAIL
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as smtp:
        smtp.login(OTP_EMAIL, _app_password())
        smtp.send_message(msg)


async def send_otp_email(to: str, otp: str) -> None:
    if not (OTP_EMAIL and OTP_EMAIL_APP_PASSWORD):
        raise RuntimeError("OTP_EMAIL and OTP_EMAIL_APP_PASSWORD must be set in .env")
    body = (
        f"Your Hive password reset code is {otp}.\n\n"
        f"It expires in {OTP_TTL_MINUTES} minutes. If you did not request this, ignore this email."
    )
    await asyncio.to_thread(_send, to, "Your Hive password reset code", body)


def _app_password() -> str:
    return OTP_EMAIL_APP_PASSWORD.replace(" ", "")
