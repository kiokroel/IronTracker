from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.models.exercise import ExerciseModel
from workout_service.src.repositories.exercise import ExerciseRepository
from workout_service.src.schemas.exercise import ExerciseCreate


class ExerciseController:
    """Controller handling business logic, validation, and IDOR protection for exercises."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.exercise_repo = ExerciseRepository(db)

    async def list_exercises(
        self,
        user_id: UUID | None = None,
        category: str | None = None,
        muscle_group: str | None = None,
        equipment: str | None = None,
        search: str | None = None,
        only_my_custom: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ExerciseModel]:
        """Retrieve exercises library filtered by criteria and accessibility rules."""
        return await self.exercise_repo.get_available_exercises(
            user_id=user_id,
            category=category,
            muscle_group=muscle_group,
            equipment=equipment,
            search=search,
            only_my_custom=only_my_custom,
            skip=skip,
            limit=limit,
        )

    async def create_custom_exercise(
        self,
        exercise_in: ExerciseCreate,
        user_id: UUID,
    ) -> ExerciseModel:
        """Create a new custom user exercise with uniqueness validation within user scope."""
        existing = await self.exercise_repo.get_by_name_and_user(exercise_in.name, user_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Exercise '{exercise_in.name}' already exists in your library",
            )

        db_exercise = ExerciseModel(
            user_id=user_id,
            name=exercise_in.name.strip(),
            category=exercise_in.category,
            target_muscle_groups=exercise_in.target_muscle_groups,
            equipment=exercise_in.equipment,
            is_custom=True,
        )
        self.db.add(db_exercise)
        try:
            await self.db.commit()
            await self.db.refresh(db_exercise)
            return db_exercise
        except Exception:
            await self.db.rollback()
            raise

    async def get_exercise(
        self,
        exercise_id: UUID,
        user_id: UUID | None = None,
    ) -> ExerciseModel:
        """Retrieve exercise by ID with IDOR access control check."""
        exercise = await self.exercise_repo.get(exercise_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exercise not found",
            )
        # IDOR protection: private custom exercises cannot be viewed by other users
        if exercise.is_custom and exercise.user_id is not None and exercise.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: cannot access another athlete's custom exercise",
            )
        return exercise

    async def delete_custom_exercise(
        self,
        exercise_id: UUID,
        user_id: UUID,
    ) -> None:
        """Delete custom exercise enforcing strict ownership and system exercise immutability."""
        exercise = await self.exercise_repo.get(exercise_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exercise not found",
            )

        # Immutability check: cannot delete global system exercises
        if not exercise.is_custom or exercise.user_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete standard system exercises",
            )

        # IDOR check: athletes can only delete their own custom exercises
        if exercise.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: cannot delete another athlete's exercise",
            )

        await self.exercise_repo.delete(exercise_id)


__all__ = ["ExerciseController"]
