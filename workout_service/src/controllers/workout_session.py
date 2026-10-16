from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.models.workout_session import WorkoutSessionModel
from workout_service.src.repositories.workout_session import WorkoutSessionRepository
from workout_service.src.schemas.workout_session import (
    WorkoutSessionCreate,
    WorkoutSessionUpdate,
)


class WorkoutSessionController:
    """Controller handling business logic, validation, and IDOR protection for workout sessions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.session_repo = WorkoutSessionRepository(db)

    async def list_sessions(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[WorkoutSessionModel]:
        """List current user's workout sessions with pagination."""
        return await self.session_repo.get_by_user_id(
            user_id=user_id,
            skip=skip,
            limit=limit,
        )

    async def create_session(
        self,
        user_id: UUID,
        data: WorkoutSessionCreate,
    ) -> WorkoutSessionModel:
        """Create a new workout session with atomic Outbox persistence."""
        session, _ = await self.session_repo.create_session_with_outbox(
            session_in=data,
            user_id=user_id,
        )
        return session

    async def get_session(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> WorkoutSessionModel:
        """Retrieve workout session enforcing IDOR ownership protection."""
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )
        if session.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: cannot access another athlete's workout session",
            )
        return session

    async def update_session(
        self,
        session_id: UUID,
        user_id: UUID,
        data: WorkoutSessionUpdate,
    ) -> WorkoutSessionModel:
        """Update workout session enforcing IDOR ownership protection."""
        await self.get_session(session_id, user_id)
        session, _ = await self.session_repo.update_session_with_outbox(
            session_id=session_id,
            session_update=data,
            user_id=user_id,
        )
        return session

    async def delete_session(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> None:
        """Delete workout session enforcing IDOR ownership protection."""
        await self.get_session(session_id, user_id)
        await self.session_repo.delete_session_with_outbox(
            session_id=session_id,
            user_id=user_id,
        )


__all__ = ["WorkoutSessionController"]
