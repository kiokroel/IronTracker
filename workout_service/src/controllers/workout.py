from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.models.workout import WorkoutModel
from workout_service.src.repositories.workout import WorkoutRepository
from workout_service.src.schemas.workout import WorkoutCreate, WorkoutUpdate


class WorkoutController:
    """Controller handling workout business logic and Transactional Outbox orchestration."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.workout_repo = WorkoutRepository(db)

    async def create_workout(
        self,
        workout_in: WorkoutCreate,
        event_type: str = "workout.completed",
    ) -> WorkoutModel:
        """Create a new workout record and record its outbox event atomically."""
        workout, _ = await self.workout_repo.create_workout_with_outbox(
            workout_in, event_type=event_type
        )
        return workout

    async def get_workout(
        self,
        workout_id: UUID,
        current_user_id: UUID | None = None,
    ) -> WorkoutModel:
        """Retrieve a workout by ID with optional IDOR access control check."""
        workout = await self.workout_repo.get(workout_id)
        if not workout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout not found",
            )
        if current_user_id is not None and workout.user_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: cannot access another user's workout",
            )
        return workout

    async def get_user_workouts(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[WorkoutModel]:
        """Retrieve paginated workouts for a specific user."""
        return await self.workout_repo.get_by_user_id(user_id, skip=skip, limit=limit)

    async def get_all_workouts(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> list[WorkoutModel]:
        """Retrieve all workouts with pagination."""
        return await self.workout_repo.get_all(skip=skip, limit=limit)

    async def update_workout(
        self,
        workout_id: UUID,
        workout_update: WorkoutUpdate,
        current_user_id: UUID | None = None,
    ) -> WorkoutModel:
        """Update workout details with transactional outbox and optional IDOR check."""
        workout = await self.get_workout(workout_id, current_user_id=current_user_id)
        updated, _ = await self.workout_repo.update_workout_with_outbox(workout, workout_update)
        return updated

    async def delete_workout(
        self,
        workout_id: UUID,
        current_user_id: UUID | None = None,
    ) -> None:
        """Delete workout and persist outbox event with optional IDOR check."""
        # Ensure workout exists and user has access
        await self.get_workout(workout_id, current_user_id=current_user_id)
        deleted = await self.workout_repo.delete_workout_with_outbox(workout_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout not found",
            )
