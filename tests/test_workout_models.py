from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import DateTime, String, select
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from workout_service.src import OutboxModel, WorkoutModel, get_settings

_test_engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
_test_session_factory = async_sessionmaker(
    bind=_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


def test_workout_model_metadata() -> None:
    """Verify WorkoutModel table name, columns, types, and indices."""
    assert WorkoutModel.__tablename__ == "workouts"

    columns = WorkoutModel.__table__.columns
    assert "id" in columns
    assert "user_id" in columns
    assert "date" in columns
    assert "type" in columns
    assert "metrics" in columns
    assert "created_at" in columns

    assert isinstance(columns["id"].type, UUID)
    assert columns["id"].primary_key is True

    assert isinstance(columns["user_id"].type, UUID)
    assert columns["user_id"].nullable is False
    assert columns["user_id"].index is True

    assert columns["date"].nullable is False
    assert isinstance(columns["date"].type, DateTime)
    assert columns["date"].type.timezone is True

    assert columns["type"].nullable is False
    assert isinstance(columns["type"].type, String)
    assert columns["type"].type.length == 50
    assert columns["type"].index is True

    assert isinstance(columns["metrics"].type, JSONB)
    assert columns["metrics"].nullable is False

    assert columns["created_at"].nullable is False
    assert isinstance(columns["created_at"].type, DateTime)
    assert columns["created_at"].type.timezone is True


def test_outbox_model_metadata() -> None:
    """Verify OutboxModel table name, columns, types, defaults, and indices."""
    assert OutboxModel.__tablename__ == "outbox"

    columns = OutboxModel.__table__.columns
    assert "id" in columns
    assert "event_type" in columns
    assert "payload" in columns
    assert "status" in columns
    assert "retry_count" in columns
    assert "created_at" in columns
    assert "processed_at" in columns

    assert isinstance(columns["id"].type, UUID)
    assert columns["id"].primary_key is True

    assert columns["event_type"].nullable is False
    assert isinstance(columns["event_type"].type, String)
    assert columns["event_type"].type.length == 255
    assert columns["event_type"].index is True

    assert isinstance(columns["payload"].type, JSONB)
    assert columns["payload"].nullable is False

    assert columns["status"].nullable is False
    assert isinstance(columns["status"].type, String)
    assert columns["status"].type.length == 50
    assert columns["status"].index is True

    assert columns["retry_count"].nullable is False

    assert columns["created_at"].nullable is False
    assert isinstance(columns["created_at"].type, DateTime)
    assert columns["created_at"].type.timezone is True

    assert columns["processed_at"].nullable is True
    assert isinstance(columns["processed_at"].type, DateTime)
    assert columns["processed_at"].type.timezone is True


def test_workout_model_instantiation() -> None:
    """Verify instantiating WorkoutModel in memory."""
    workout_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    metrics = {"weight_kg": 100.0, "reps": 5, "rpe": 8.5}

    workout = WorkoutModel(
        id=workout_id,
        user_id=user_id,
        date=now,
        type="bench_press",
        metrics=metrics,
        created_at=now,
    )

    assert workout.id == workout_id
    assert workout.user_id == user_id
    assert workout.type == "bench_press"
    assert workout.metrics == metrics
    assert workout.metrics["weight_kg"] == 100.0
    assert workout.date == now
    assert workout.created_at == now


def test_outbox_model_instantiation() -> None:
    """Verify instantiating OutboxModel in memory with default values."""
    event_id = uuid.uuid4()
    payload = {"workout_id": str(uuid.uuid4()), "user_id": str(uuid.uuid4())}
    now = datetime.now(UTC)

    outbox = OutboxModel(
        id=event_id,
        event_type="workout.created",
        payload=payload,
        created_at=now,
    )

    assert outbox.id == event_id
    assert outbox.event_type == "workout.created"
    assert outbox.payload == payload
    assert outbox.created_at == now


@pytest.mark.asyncio
async def test_transactional_outbox_database_roundtrip() -> None:
    """Verify saving WorkoutModel and OutboxModel atomically in the database."""
    workout_id = uuid.uuid4()
    user_id = uuid.uuid4()
    outbox_id = uuid.uuid4()
    now = datetime.now(UTC)

    workout_metrics = {
        "exercise_type": "squat",
        "weight_kg": 140.0,
        "reps": 3,
        "sets": 5,
        "rpe": 9.0,
    }

    event_payload = {
        "event_id": str(outbox_id),
        "workout_id": str(workout_id),
        "user_id": str(user_id),
        "type": "squat",
        "metrics": workout_metrics,
        "created_at": now.isoformat(),
    }

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_id,
            date=now,
            type="squat",
            metrics=workout_metrics,
            created_at=now,
        )
        outbox = OutboxModel(
            id=outbox_id,
            event_type="workout.created",
            payload=event_payload,
            status="pending",
            retry_count=0,
            created_at=now,
        )

        session.add(workout)
        session.add(outbox)
        await session.commit()

        # Query back workout
        stmt_w = select(WorkoutModel).where(WorkoutModel.id == workout_id)
        result_w = await session.execute(stmt_w)
        fetched_workout = result_w.scalar_one_or_none()
        assert fetched_workout is not None
        assert fetched_workout.id == workout_id
        assert fetched_workout.user_id == user_id
        assert fetched_workout.type == "squat"
        assert fetched_workout.metrics == workout_metrics
        assert fetched_workout.metrics["weight_kg"] == 140.0

        # Query back outbox
        stmt_o = select(OutboxModel).where(OutboxModel.id == outbox_id)
        result_o = await session.execute(stmt_o)
        fetched_outbox = result_o.scalar_one_or_none()
        assert fetched_outbox is not None
        assert fetched_outbox.id == outbox_id
        assert fetched_outbox.event_type == "workout.created"
        assert fetched_outbox.status == "pending"
        assert fetched_outbox.retry_count == 0
        assert fetched_outbox.payload == event_payload
        assert fetched_outbox.processed_at is None

        # Clean up
        await session.delete(fetched_workout)
        await session.delete(fetched_outbox)
        await session.commit()


@pytest.mark.asyncio
async def test_transactional_outbox_atomicity_rollback() -> None:
    """Verify rollback ensures neither workout nor outbox event is persisted on error."""
    workout_id = uuid.uuid4()
    user_id = uuid.uuid4()
    outbox_id = uuid.uuid4()
    now = datetime.now(UTC)

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_id,
            date=now,
            type="deadlift",
            metrics={"weight_kg": 180.0, "reps": 1},
            created_at=now,
        )
        outbox = OutboxModel(
            id=outbox_id,
            event_type="workout.created",
            payload={"workout_id": str(workout_id)},
            status="pending",
            retry_count=0,
            created_at=now,
        )

        session.add(workout)
        session.add(outbox)
        # Flush to check SQL generation, then rollback
        await session.flush()
        await session.rollback()

        # Verify nothing persisted
        stmt_w = select(WorkoutModel).where(WorkoutModel.id == workout_id)
        result_w = await session.execute(stmt_w)
        assert result_w.scalar_one_or_none() is None

        stmt_o = select(OutboxModel).where(OutboxModel.id == outbox_id)
        result_o = await session.execute(stmt_o)
        assert result_o.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_models_database_defaults() -> None:
    """Verify default values are populated on insert without explicitly providing them."""
    user_id = uuid.uuid4()
    metrics = {"distance_km": 5.0, "duration_minutes": 25.0}
    payload = {"sync": True}

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            user_id=user_id,
            type="running",
            metrics=metrics,
        )
        outbox = OutboxModel(
            event_type="workout.created",
            payload=payload,
        )

        session.add(workout)
        session.add(outbox)
        await session.commit()

        # Check WorkoutModel defaults
        assert workout.id is not None
        assert isinstance(workout.id, uuid.UUID)
        assert workout.date is not None
        assert isinstance(workout.date, datetime)
        assert workout.created_at is not None
        assert isinstance(workout.created_at, datetime)

        # Check OutboxModel defaults
        assert outbox.id is not None
        assert isinstance(outbox.id, uuid.UUID)
        assert outbox.status == "pending"
        assert outbox.retry_count == 0
        assert outbox.created_at is not None
        assert isinstance(outbox.created_at, datetime)
        assert outbox.processed_at is None

        # Clean up
        await session.delete(workout)
        await session.delete(outbox)
        await session.commit()
