from __future__ import annotations

from fastapi import APIRouter

from workout_service.src.routes.exercises import router as exercises_router
from workout_service.src.routes.workouts import router as workouts_router

router = APIRouter()
router.include_router(workouts_router, prefix="/api/v1")
router.include_router(exercises_router, prefix="/api/v1")

__all__ = [
    "exercises_router",
    "router",
    "workouts_router",
]
