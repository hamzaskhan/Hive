from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class AccountType(str, Enum):
    human = "human"
    ai_worker = "ai_worker"


class NotificationPreferences(BaseModel):
    email_summary: bool = True
    action_item_reminders: bool = True


class MeetingPreferences(BaseModel):
    auto_record: bool = True
    camera_on_join: bool = True
    mic_on_join: bool = True
    summary_template: str = "general"


class Preferences(BaseModel):
    work_role: str | None = None
    work_description: str | None = None
    timezone: str = "UTC"
    language: str = "en"
    notifications: NotificationPreferences = Field(default_factory=NotificationPreferences)
    meeting: MeetingPreferences = Field(default_factory=MeetingPreferences)


class PreferencesUpdate(BaseModel):
    work_role: str | None = None
    work_description: str | None = None
    timezone: str | None = None
    language: str | None = None
    notifications: NotificationPreferences | None = None
    meeting: MeetingPreferences | None = None


class Consent(BaseModel):
    terms_version: str
    accepted_at: datetime


class Onboarding(BaseModel):
    completed: bool = False
    calendar_connected: bool = False
    zoom_connected: bool = False


class UserPublic(BaseModel):
    user_id: str
    email: EmailStr
    full_name: str
    account_type: AccountType
    preferences: Preferences
    onboarding: Onboarding
    consent: Consent
    created_at: datetime
