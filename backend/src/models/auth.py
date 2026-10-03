from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from src.models.user import AccountType, UserPublic

# bcrypt only uses the first 72 bytes of a password
Password = Field(min_length=8, max_length=72)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Password
    full_name: str = Field(min_length=1, max_length=120)
    account_type: AccountType = AccountType.human
    accept_terms: bool = Field(description="Must be true; consent is recorded at signup")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class AuthResponse(TokenPair):
    user: UserPublic


class PreForgetPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")


class VerifyOtpResponse(BaseModel):
    otp_verified: bool
    reset_token: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str = Password


class MessageResponse(BaseModel):
    message: str
