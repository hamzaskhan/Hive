from fastapi import APIRouter, Depends

from src.core import user_service
from src.middleware.auth import get_current_user
from src.models.user import Preferences, PreferencesUpdate, UserPublic

router = APIRouter(prefix="/users", tags=["human: users"])


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return user_service.to_public(user)


@router.get("/me/preferences", response_model=Preferences)
async def get_preferences(user: dict = Depends(get_current_user)):
    return user["preferences"]


@router.patch("/me/preferences", response_model=Preferences)
async def update_preferences(body: PreferencesUpdate, user: dict = Depends(get_current_user)):
    updated = await user_service.update_preferences(user["user_id"], body)
    return updated["preferences"]
