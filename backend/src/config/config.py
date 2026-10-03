import os

from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_DB = os.getenv("MONGODB_DB", "fathom_agents")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-insecure-jwt-secret")
TOKEN_HMAC_SECRET = os.getenv("TOKEN_HMAC_SECRET", "dev-insecure-hmac-secret")
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
BCRYPT_ROUNDS = int(os.getenv("BCRYPT_ROUNDS", "10"))

OTP_EMAIL = os.getenv("OTP_EMAIL", "")
OTP_EMAIL_APP_PASSWORD = os.getenv("OTP_EMAIL_APP_PASSWORD", "")
OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))

# LiveKit — backend auth uses API key/secret; clients connect with a minted participant token
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
# Optional; falls back to LIVEKIT_URL (wss) for the browser SDK
LIVEKIT_WEBSOCKET_URL = os.getenv("LiveKit_WEBSOCKET_URL") or os.getenv("LIVEKIT_WEBSOCKET_URL") or ""
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "http://localhost:5173")

# AWS S3 — LiveKit Egress writes here; boto3 builds/validates object URLs
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET = os.getenv("S3_BUCKET") or os.getenv("AWS_S3_BUCKET") or ""
S3_RECORDINGS_PREFIX = os.getenv("S3_RECORDINGS_PREFIX", "hive-recordings")

# Google Gemini (multimodal audio → transcript + summary)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
