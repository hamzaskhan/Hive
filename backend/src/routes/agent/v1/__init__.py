from fastapi import APIRouter

from src.routes.agent.v1 import portal

router = APIRouter(prefix="/agent/v1")
router.include_router(portal.router)
