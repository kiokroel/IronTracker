from __future__ import annotations

import uuid
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.models.outbox import OutboxModel
from workout_service.src.models.workout_session import WorkoutSessionModel
from workout_service.src.repositories.base import BaseRepository
from workout_service.src.schemas.workout_session import (
    WorkoutSessionCreate,
    WorkoutSessionUpdate,
    calculate_session_tonnage,
)


class WorkoutSessionRepository(
    BaseRepository[WorkoutSessionModel, WorkoutSessionCreate, WorkoutSessionUpdate]
):
    """Repository for managing multi-exercise workout sessions with Transactional Outbox."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, WorkoutSessionModel)

    async def get_by_id(self, session_id: UUID) -> WorkoutSessionModel | None:
        """Retrieve workout session by ID."""
        return await self.get(session_id)

    async def get_by_user_id(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[WorkoutSessionModel]:
        """Retrieve user's workout sessions ordered by date descending."""
        stmt = (
            select(WorkoutSessionModel)
            .where(WorkoutSessionModel.user_id == user_id)
            .order_by(WorkoutSessionModel.date.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_session_with_outbox(
        self,
        session_in: WorkoutSessionCreate,
        user_id: UUID,
    ) -> tuple[WorkoutSessionModel, OutboxModel]:
        """Create a multi-exercise session and persist Outbox event atomically."""
        now = datetime.now(UTC)
        session_id = uuid.uuid4()
        session_date = session_in.date or now

        total_tonnage = calculate_session_tonnage(session_in.exercises)
        exercises_json = [e.model_dump(mode="json") for e in session_in.exercises]

        session = WorkoutSessionModel(
            id=session_id,
            user_id=user_id,
            title=session_in.title,
            date=session_date,
            total_tonnage=total_tonnage,
            duration_minutes=session_in.duration_minutes,
            exercises=exercises_json,
            notes=session_in.notes,
            created_at=now,
            updated_at=now,
        )

        outbox_payload = {
            "event_id": str(uuid.uuid4()),
            "event_type": "workout_session.completed",
            "session_id": str(session.id),
            "user_id": str(session.user_id),
            "title": session.title,
            "date": session.date.isoformat(),
            "total_tonnage": session.total_tonnage,
            "duration_minutes": session.duration_minutes,
            "exercises_count": len(session.exercises),
            "created_at": now.isoformat(),
        }

        outbox_entry = OutboxModel(
            id=uuid.uuid4(),
            event_type="workout_session.completed",
            payload=outbox_payload,
            status="pending",
            retry_count=0,
            created_at=now,
        )

        self.db.add(session)
        self.db.add(outbox_entry)
        await self.db.commit()
        await self.db.refresh(session)
        await self.db.refresh(outbox_entry)

        return session, outbox_entry

    async def update_session_with_outbox(
        self,
        session_id: UUID,
        session_update: WorkoutSessionUpdate,
        user_id: UUID,
    ) -> tuple[WorkoutSessionModel, OutboxModel]:
        """Update workout session and persist outbox event atomically."""
        session = await self.get(session_id)
        if not session:
            raise ValueError("Workout session not found")

        now = datetime.now(UTC)
        if session_update.title is not None:
            session.title = session_update.title
        if session_update.date is not None:
            session.date = session_update.date
        if session_update.duration_minutes is not None:
            session.duration_minutes = session_update.duration_minutes
        if session_update.notes is not None:
            session.notes = session_update.notes
        if session_update.exercises is not None:
            session.exercises = [e.model_dump(mode="json") for e in session_update.exercises]
            session.total_tonnage = calculate_session_tonnage(session_update.exercises)

        session.updated_at = now

        outbox_payload = {
            "event_id": str(uuid.uuid4()),
            "event_type": "workout_session.updated",
            "session_id": str(session.id),
            "user_id": str(session.user_id),
            "total_tonnage": session.total_tonnage,
            "updated_at": now.isoformat(),
        }

        outbox_entry = OutboxModel(
            id=uuid.uuid4(),
            event_type="workout_session.updated",
            payload=outbox_payload,
            status="pending",
            retry_count=0,
            created_at=now,
        )

        self.db.add(session)
        self.db.add(outbox_entry)
        await self.db.commit()
        await self.db.refresh(session)
        await self.db.refresh(outbox_entry)

        return session, outbox_entry

    async def delete_session_with_outbox(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> OutboxModel:
        """Delete workout session and record outbox event atomically."""
        session = await self.get(session_id)
        if not session:
            raise ValueError("Workout session not found")

        now = datetime.now(UTC)
        outbox_payload = {
            "event_id": str(uuid.uuid4()),
            "event_type": "workout_session.deleted",
            "session_id": str(session.id),
            "user_id": str(session.user_id),
            "deleted_at": now.isoformat(),
        }

        outbox_entry = OutboxModel(
            id=uuid.uuid4(),
            event_type="workout_session.deleted",
            payload=outbox_payload,
            status="pending",
            retry_count=0,
            created_at=now,
        )

        await self.db.delete(session)
        self.db.add(outbox_entry)
        await self.db.commit()
        await self.db.refresh(outbox_entry)

        return outbox_entry


__all__ = ["WorkoutSessionRepository"]
