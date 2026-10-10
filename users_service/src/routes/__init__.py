from __future__ import annotations

from fastapi import APIRouter

from users_service.src.routes.users import router as users_router

router = APIRouter(prefix="/api/v1")
router.include_router(users_router)

__all__ = ["router"]
