from fastapi import APIRouter

from src.routes.human.v1 import agent_accounts, auth, meetings, users

router = APIRouter(prefix="/human/v1")
router.include_router(auth.router)
router.include_router(users.router)
router.include_router(meetings.router)
router.include_router(agent_accounts.router)
