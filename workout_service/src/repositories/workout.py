from __future__ import annotations

import uuid
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.contracts.src.events import WorkoutCreatedEvent
from workout_service.src.models.outbox import OutboxModel
from workout_service.src.models.workout import WorkoutModel
from workout_service.src.repositories.base import BaseRepository
from workout_service.src.schemas.workout import WorkoutCreate, WorkoutUpdate


class WorkoutRepository(BaseRepository[WorkoutModel, WorkoutCreate, WorkoutUpdate]):
    """Workout repository with specialized query methods and Transactional Outbox."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, WorkoutModel)

    async def get_by_id(self, workout_id: UUID) -> WorkoutModel | None:
        """Retrieve workout entity by primary key ID."""
        return await self.get(workout_id)

    async def get_by_user_id(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[WorkoutModel]:
        """Retrieve paginated workouts for a specific user ordered by date descending."""
        stmt = (
            select(WorkoutModel)
            .where(WorkoutModel.user_id == user_id)
            .order_by(WorkoutModel.date.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_workout_with_outbox(
        self,
        workout_in: WorkoutCreate,
    ) -> tuple[WorkoutModel, OutboxModel]:
        """Create a workout and persist a transactional outbox event atomically.

        Prevents dual writes by committing the domain entity and outbox message
        within a single PostgreSQL transaction.
        """
        now = datetime.now(UTC)
        workout_id = uuid.uuid4()
        metrics_data = workout_in.metrics.model_dump(mode="json")

        workout = WorkoutModel(
            id=workout_id,
            user_id=workout_in.user_id,
            date=workout_in.date,
            type=workout_in.type,
            metrics=metrics_data,
            created_at=now,
        )

        event = WorkoutCreatedEvent(
            event_id=uuid.uuid4(),
            occurred_at=now,
            workout_id=workout.id,
            user_id=workout.user_id,
            created_at=workout.created_at,
            metrics=workout_in.metrics,
        )

        outbox = OutboxModel(
            id=event.event_id,
            event_type=event.event_type,
            payload=event.model_dump(mode="json"),
            status="pending",
            retry_count=0,
            created_at=event.occurred_at,
        )

        self.db.add(workout)
        self.db.add(outbox)
        await self.db.commit()
        await self.db.refresh(workout)

        return workout, outbox

    # Alias for convenience
    create_with_outbox = create_workout_with_outbox

    async def create(self, obj_in: WorkoutCreate) -> WorkoutModel:
        """Create a workout with transactional outbox, fulfilling base repository contract."""
        workout, _ = await self.create_workout_with_outbox(obj_in)
        return workout

    async def update_workout_with_outbox(
        self,
        db_obj: WorkoutModel,
        obj_in: WorkoutUpdate,
    ) -> tuple[WorkoutModel, OutboxModel]:
        """Update a workout and persist an update event in outbox atomically."""
        obj_data = obj_in.model_dump(exclude_unset=True)

        if "metrics" in obj_data and obj_in.metrics is not None:
            obj_data["metrics"] = obj_in.metrics.model_dump(mode="json")

        for field, value in obj_data.items():
            setattr(db_obj, field, value)

        event_id = uuid.uuid4()
        now = datetime.now(UTC)
        payload = {
            "event_id": str(event_id),
            "workout_id": str(db_obj.id),
            "user_id": str(db_obj.user_id),
            "updated_fields": list(obj_data.keys()),
            "type": db_obj.type,
            "metrics": db_obj.metrics,
            "date": db_obj.date.isoformat(),
        }

        outbox = OutboxModel(
            id=event_id,
            event_type="workout.updated",
            payload=payload,
            status="pending",
            retry_count=0,
            created_at=now,
        )

        self.db.add(db_obj)
        self.db.add(outbox)
        await self.db.commit()
        await self.db.refresh(db_obj)

        return db_obj, outbox

    async def delete_workout_with_outbox(self, id: UUID) -> bool:
        """Delete a workout and persist a deletion event in outbox atomically."""
        workout = await self.get(id)
        if not workout:
            return False

        event_id = uuid.uuid4()
        now = datetime.now(UTC)
        payload = {
            "event_id": str(event_id),
            "workout_id": str(workout.id),
            "user_id": str(workout.user_id),
        }

        outbox = OutboxModel(
            id=event_id,
            event_type="workout.deleted",
            payload=payload,
            status="pending",
            retry_count=0,
            created_at=now,
        )

        self.db.add(outbox)
        await self.db.delete(workout)
        await self.db.commit()
        return True
