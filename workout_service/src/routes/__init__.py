from __future__ import annotations

from fastapi import APIRouter

from workout_service.src.routes.workouts import router as workouts_router

router = APIRouter()
router.include_router(workouts_router, prefix="/api")
router.include_router(workouts_router)

__all__ = [
    "router",
    "workouts_router",
]
