from fastapi import APIRouter, status

from src.core import auth_service, password_reset_service
from src.models.auth import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    PreForgetPasswordRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenPair,
    VerifyOtpRequest,
    VerifyOtpResponse,
)

router = APIRouter(prefix="/auth", tags=["human: auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest):
    return await auth_service.signup(body)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    return await auth_service.login(body)


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest):
    return await auth_service.refresh(body.refresh_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(body: RefreshRequest):
    await auth_service.logout(body.refresh_token)
    return MessageResponse(message="Logged out")


@router.post("/pre_forget_password", response_model=MessageResponse)
async def pre_forget_password(body: PreForgetPasswordRequest):
    await password_reset_service.pre_forget_password(body.email)
    return MessageResponse(message="If an account exists for this email, a code has been sent")


@router.post("/verify_otp", response_model=VerifyOtpResponse)
async def verify_otp(body: VerifyOtpRequest):
    reset_token = await password_reset_service.verify_otp(body.email, body.otp)
    return VerifyOtpResponse(otp_verified=True, reset_token=reset_token)


@router.post("/reset_password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest):
    await password_reset_service.reset_password(body.reset_token, body.new_password)
    return MessageResponse(message="Password updated. Please log in again.")
