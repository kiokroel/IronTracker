from __future__ import annotations

from fastapi import APIRouter

from leaderboard_service.src.routes.leaderboard import router as leaderboard_router

# Aggregating router configured with canonical /api/v1 prefix for all domain endpoints
router = APIRouter(prefix="/api/v1")
router.include_router(leaderboard_router)

__all__ = [
    "leaderboard_router",
    "router",
]
