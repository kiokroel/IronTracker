from __future__ import annotations

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.models.exercise import ExerciseModel
from workout_service.src.repositories.base import BaseRepository
from workout_service.src.schemas.exercise import ExerciseCreate, ExerciseUpdate


class ExerciseRepository(BaseRepository[ExerciseModel, ExerciseCreate, ExerciseUpdate]):
    """Repository handling CRUD operations and queries for exercise library."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, ExerciseModel)

    async def get_available_exercises(
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
        """Fetch accessible exercises for a user with flexible filtering."""
        stmt = select(ExerciseModel)

        if only_my_custom:
            if user_id is None:
                return []
            stmt = stmt.where(
                ExerciseModel.user_id == user_id,
                ExerciseModel.is_custom.is_(True),
            )
        else:
            if user_id is not None:
                stmt = stmt.where(
                    or_(ExerciseModel.user_id.is_(None), ExerciseModel.user_id == user_id)
                )
            else:
                stmt = stmt.where(ExerciseModel.user_id.is_(None))

        if category:
            stmt = stmt.where(ExerciseModel.category == category)

        if equipment:
            stmt = stmt.where(ExerciseModel.equipment == equipment)

        if search and search.strip():
            search_pattern = f"%{search.strip().lower()}%"
            stmt = stmt.where(ExerciseModel.name.ilike(search_pattern))

        if muscle_group and muscle_group.strip():
            # JSONB contains operator to filter array of muscle groups
            stmt = stmt.where(ExerciseModel.target_muscle_groups.contains([muscle_group.strip()]))

        stmt = (
            stmt.order_by(ExerciseModel.is_custom.asc(), ExerciseModel.name.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_name_and_user(
        self,
        name: str,
        user_id: UUID | None,
    ) -> ExerciseModel | None:
        """Find an exercise by exact case-insensitive name for a specific user scope."""
        stmt = select(ExerciseModel).where(
            ExerciseModel.name.ilike(name.strip()),
            ExerciseModel.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()


__all__ = ["ExerciseRepository"]
