from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from workout_service.src import OutboxModel, WorkoutModel, app, get_settings
from workout_service.src.dependencies import get_db, get_db_session
from workout_service.src.repositories.workout import WorkoutRepository
from workout_service.src.schemas.workout import WorkoutCreate

_test_engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
_test_session_factory = async_sessionmaker(
    bind=_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(autouse=True)
async def _override_db_session() -> AsyncGenerator[None, None]:
    """Ensure each async test function gets isolated database connections via NullPool."""

    async def _test_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with _test_session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _test_get_db
    app.dependency_overrides[get_db_session] = _test_get_db
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_db_session, None)


# ==============================================================================
# 1. Transactional Outbox Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_transactional_outbox_pending_status_on_create_api() -> None:
    """Verify that POST /api/v1/workouts atomically creates outbox entry with status 'pending'."""
    user_id = uuid.uuid4()
    payload = {
        "user_id": str(user_id),
        "type": "bench_press",
        "date": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "bench_press",
            "weight": 110.0,
            "sets": 4,
            "reps": 6,
            "rpe": 8.5,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
        assert res.status_code == 201
        data = res.json()
        workout_id = uuid.UUID(data["id"])

    # Verify directly in PostgreSQL that outbox record exists with 'pending' status
    async with _test_session_factory() as session:
        # Check workout
        workout = await session.get(WorkoutModel, workout_id)
        assert workout is not None
        assert workout.user_id == user_id
        assert workout.type == "bench_press"

        # Check outbox
        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        result = await session.execute(stmt)
        outbox_entry = result.scalar_one_or_none()

        assert outbox_entry is not None
        assert outbox_entry.event_type in ("workout.completed", "workout.created")
        assert outbox_entry.status == "pending"
        assert outbox_entry.retry_count == 0
        assert outbox_entry.payload["workout_id"] == str(workout_id)
        assert outbox_entry.payload["user_id"] == str(user_id)
        assert outbox_entry.payload["metrics"]["weight"] == 110.0

        # Cleanup
        await session.delete(workout)
        await session.delete(outbox_entry)
        await session.commit()


@pytest.mark.asyncio
async def test_transactional_outbox_cardio_creation_and_update_lifecycle() -> None:
    """Verify outbox entries for cardio workout creation and subsequent update via API."""
    user_id = uuid.uuid4()
    create_payload = {
        "user_id": str(user_id),
        "type": "running",
        "date": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "cardio",
            "exercise_name": "running",
            "distance_km": 10.0,
            "duration_minutes": 50.0,
            "heart_rate": 155,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create cardio workout
        res_create = await client.post("/api/v1/workouts", json=create_payload)
        assert res_create.status_code == 201
        workout_id = uuid.UUID(res_create.json()["id"])

        # 2. Update workout metrics
        update_payload = {
            "metrics": {
                "exercise_type": "cardio",
                "exercise_name": "running",
                "distance_km": 12.0,
                "duration_minutes": 60.0,
                "heart_rate": 160,
            }
        }
        res_update = await client.put(
            f"/api/v1/workouts/{workout_id}",
            json=update_payload,
            headers={"X-User-ID": str(user_id)},
        )
        assert res_update.status_code == 200
        assert res_update.json()["metrics"]["distance_km"] == 12.0

        # 3. Delete workout
        res_delete = await client.delete(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_id)},
        )
        assert res_delete.status_code == 204

    # Verify outbox records in DB
    async with _test_session_factory() as session:
        # Workout must be deleted
        workout_deleted = await session.get(WorkoutModel, workout_id)
        assert workout_deleted is None

        # Verify created, updated, and deleted outbox records exist with 'pending' status
        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        result = await session.execute(stmt)
        outbox_entries = list(result.scalars().all())

        assert len(outbox_entries) == 3
        event_types = {entry.event_type for entry in outbox_entries}
        assert event_types in (
            {"workout.created", "workout.updated", "workout.deleted"},
            {"workout.completed", "workout.updated", "workout.deleted"},
        )
        for entry in outbox_entries:
            assert entry.status == "pending"

        # Cleanup outbox records
        for entry in outbox_entries:
            await session.delete(entry)
        await session.commit()


@pytest.mark.asyncio
async def test_transactional_outbox_rollback_leaves_no_outbox_or_workout() -> None:
    """Verify rollback ensures neither outbox entry nor workout is committed."""
    user_id = uuid.uuid4()
    workout_id = uuid.uuid4()
    outbox_id = uuid.uuid4()
    now = datetime.now(UTC)

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_id,
            date=now,
            type="overhead_press",
            metrics={
                "exercise_type": "strength",
                "exercise_name": "overhead_press",
                "weight": 60.0,
                "sets": 3,
                "reps": 8,
            },
            created_at=now,
        )
        outbox = OutboxModel(
            id=outbox_id,
            event_type="workout.created",
            payload={"workout_id": str(workout_id), "user_id": str(user_id)},
            status="pending",
            retry_count=0,
            created_at=now,
        )

        session.add(workout)
        session.add(outbox)
        # Flush to DB to populate pending state, then trigger rollback
        await session.flush()
        await session.rollback()

    # In a clean session, verify neither workout nor outbox exists
    async with _test_session_factory() as verify_session:
        persisted_workout = await verify_session.get(WorkoutModel, workout_id)
        persisted_outbox = await verify_session.get(OutboxModel, outbox_id)

        assert persisted_workout is None, "Workout must not be persisted after rollback"
        assert persisted_outbox is None, "Outbox entry must not be persisted after rollback"


@pytest.mark.asyncio
async def test_repository_failure_rolls_back_atomically() -> None:
    """Verify WorkoutRepository rollback on commit error ensures outbox entry is absent."""
    user_id = uuid.uuid4()
    dto = WorkoutCreate(
        user_id=user_id,
        type="squat",
        date=datetime.now(UTC),
        metrics={  # type: ignore[arg-type]
            "exercise_type": "strength",
            "exercise_name": "squat",
            "weight": 140.0,
            "sets": 5,
            "reps": 5,
        },
    )

    async with _test_session_factory() as session:
        repo = WorkoutRepository(session)
        with patch.object(
            session, "commit", side_effect=RuntimeError("Simulated database failure")
        ):
            with pytest.raises(RuntimeError, match="Simulated database failure"):
                await repo.create_workout_with_outbox(dto)
            await session.rollback()

    # Verify no orphan outbox entry was left in DB
    async with _test_session_factory() as verify_session:
        stmt = select(OutboxModel).where(OutboxModel.payload["user_id"].as_string() == str(user_id))
        result = await verify_session.execute(stmt)
        entries = list(result.scalars().all())
        assert len(entries) == 0, "No outbox records should exist after repository commit failure"


# ==============================================================================
# 2. Discriminated Unions & JSONB Strict Validation Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_jsonb_validation_missing_discriminator_returns_422() -> None:
    """Verify that omitting 'exercise_type' discriminator returns HTTP 422 Unprocessable Entity."""
    payload = {
        "user_id": str(uuid.uuid4()),
        "type": "unknown_exercise",
        "metrics": {
            "weight": 80.0,
            "reps": 10,
        },
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
    assert res.status_code == 422
    assert "exercise_type" in res.text


@pytest.mark.asyncio
async def test_jsonb_validation_invalid_discriminator_returns_422() -> None:
    """Verify that unsupported 'exercise_type' discriminator value returns HTTP 422."""
    payload = {
        "user_id": str(uuid.uuid4()),
        "type": "swimming",
        "metrics": {
            "exercise_type": "swimming_unsupported",
            "distance_km": 1.5,
        },
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
    assert res.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_strength_metrics",
    [
        # Missing exercise_name
        {"exercise_type": "strength", "weight": 80.0, "sets": 3, "reps": 10},
        # Missing weight
        {"exercise_type": "strength", "exercise_name": "bench", "sets": 3, "reps": 10},
        # Missing sets
        {"exercise_type": "strength", "exercise_name": "bench", "weight": 80.0, "reps": 10},
        # Missing reps
        {"exercise_type": "strength", "exercise_name": "bench", "weight": 80.0, "sets": 3},
        # Negative weight
        {
            "exercise_type": "strength",
            "exercise_name": "bench",
            "weight": -50.0,
            "sets": 3,
            "reps": 10,
        },
        # Zero weight (gt=0)
        {
            "exercise_type": "strength",
            "exercise_name": "bench",
            "weight": 0.0,
            "sets": 3,
            "reps": 10,
        },
        # Zero sets (gt=0)
        {
            "exercise_type": "strength",
            "exercise_name": "bench",
            "weight": 80.0,
            "sets": 0,
            "reps": 10,
        },
        # Negative reps (gt=0)
        {
            "exercise_type": "strength",
            "exercise_name": "bench",
            "weight": 80.0,
            "sets": 3,
            "reps": -5,
        },
        # RPE out of upper bound (> 10.0)
        {
            "exercise_type": "strength",
            "exercise_name": "bench",
            "weight": 80.0,
            "sets": 3,
            "reps": 10,
            "rpe": 10.5,
        },
        # RPE out of lower bound (< 1.0)
        {
            "exercise_type": "strength",
            "exercise_name": "bench",
            "weight": 80.0,
            "sets": 3,
            "reps": 10,
            "rpe": 0.5,
        },
        # Extra forbidden field
        {
            "exercise_type": "strength",
            "exercise_name": "bench",
            "weight": 80.0,
            "sets": 3,
            "reps": 10,
            "hack": "extra",
        },
    ],
)
async def test_jsonb_validation_invalid_strength_metrics_returns_422(
    invalid_strength_metrics: dict[str, object],
) -> None:
    """Verify that invalid strength exercise metrics are rejected with 422 Unprocessable Entity."""
    payload = {
        "user_id": str(uuid.uuid4()),
        "type": "bench_press",
        "metrics": invalid_strength_metrics,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
    assert res.status_code == 422, (
        f"Expected 422 for metrics: {invalid_strength_metrics}, got {res.status_code}"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_cardio_metrics",
    [
        # Missing exercise_name
        {"exercise_type": "cardio", "distance_km": 5.0, "duration_minutes": 30.0},
        # Missing duration
        {
            "exercise_type": "cardio",
            "exercise_name": "run",
            "distance_km": 5.0,
            "heart_rate": 140,
        },
        # Missing distance_km
        {
            "exercise_type": "cardio",
            "exercise_name": "run",
            "duration_minutes": 30.0,
            "heart_rate": 140,
        },
        # Negative distance
        {
            "exercise_type": "cardio",
            "exercise_name": "run",
            "distance_km": -3.0,
            "duration_minutes": 30.0,
            "heart_rate": 140,
        },
        # Zero distance (gt=0)
        {
            "exercise_type": "cardio",
            "exercise_name": "run",
            "distance_km": 0.0,
            "duration_minutes": 30.0,
            "heart_rate": 140,
        },
        # Negative duration
        {
            "exercise_type": "cardio",
            "exercise_name": "run",
            "distance_km": 5.0,
            "duration_minutes": -30.0,
            "heart_rate": 140,
        },
        # Zero duration (gt=0)
        {
            "exercise_type": "cardio",
            "exercise_name": "run",
            "distance_km": 5.0,
            "duration_minutes": 0.0,
            "heart_rate": 140,
        },
        # Zero heart rate (gt=0)
        {
            "exercise_type": "cardio",
            "exercise_name": "run",
            "distance_km": 5.0,
            "duration_minutes": 30.0,
            "heart_rate": 0,
        },
        # Negative heart rate (gt=0)
        {
            "exercise_type": "cardio",
            "exercise_name": "run",
            "distance_km": 5.0,
            "duration_minutes": 30.0,
            "heart_rate": -120,
        },
        # Extra forbidden field
        {
            "exercise_type": "cardio",
            "exercise_name": "run",
            "distance_km": 5.0,
            "duration_minutes": 30.0,
            "heart_rate": 140,
            "extra": 123,
        },
    ],
)
async def test_jsonb_validation_invalid_cardio_metrics_returns_422(
    invalid_cardio_metrics: dict[str, object],
) -> None:
    """Verify that invalid cardio exercise metrics are rejected with 422 Unprocessable Entity."""
    payload = {
        "user_id": str(uuid.uuid4()),
        "type": "cardio_run",
        "metrics": invalid_cardio_metrics,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
    assert res.status_code == 422, (
        f"Expected 422 for metrics: {invalid_cardio_metrics}, got {res.status_code}"
    )


@pytest.mark.asyncio
async def test_jsonb_validation_on_update_returns_422() -> None:
    """Verify that updating a workout with invalid JSONB metrics returns 422."""
    user_id = uuid.uuid4()
    valid_create = {
        "user_id": str(user_id),
        "type": "squat",
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "squat",
            "weight": 100.0,
            "sets": 3,
            "reps": 5,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_create = await client.post("/api/v1/workouts", json=valid_create)
        assert res_create.status_code == 201
        workout_id = uuid.UUID(res_create.json()["id"])

        # Try updating with negative weight
        invalid_update = {
            "metrics": {
                "exercise_type": "strength",
                "exercise_name": "squat",
                "weight": -20.0,
                "sets": 3,
                "reps": 5,
            }
        }
        res_update = await client.put(
            f"/api/v1/workouts/{workout_id}",
            json=invalid_update,
            headers={"X-User-ID": str(user_id)},
        )
        assert res_update.status_code == 422

        # Cleanup
        await client.delete(f"/api/v1/workouts/{workout_id}", headers={"X-User-ID": str(user_id)})

    # Clean up outbox entries
    async with _test_session_factory() as session:
        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        result = await session.execute(stmt)
        for ob in result.scalars().all():
            await session.delete(ob)
        await session.commit()


# ==============================================================================
# 3. Security: IDOR (Insecure Direct Object Reference) Protection Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_idor_protection_prevents_unauthorized_access() -> None:
    """Verify User B cannot read, update, or delete User A's workout (HTTP 403 Forbidden)."""
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()

    create_payload = {
        "user_id": str(user_a),
        "type": "pull_up",
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "pull_up",
            "weight": 15.0,
            "sets": 4,
            "reps": 8,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create workout owned by User A
        res_create = await client.post("/api/v1/workouts", json=create_payload)
        assert res_create.status_code == 201
        workout_id = uuid.UUID(res_create.json()["id"])

        # 1. IDOR on GET: User B attempts to view User A's workout -> 403 Forbidden
        res_get_unauthorized = await client.get(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_b)},
        )
        assert res_get_unauthorized.status_code == 403
        assert "cannot access another user's workout" in res_get_unauthorized.text

        # 2. IDOR on PUT: User B attempts to modify User A's workout -> 403 Forbidden
        res_put_unauthorized = await client.put(
            f"/api/v1/workouts/{workout_id}",
            json={"type": "tampered_workout"},
            headers={"X-User-ID": str(user_b)},
        )
        assert res_put_unauthorized.status_code == 403
        assert "cannot access another user's workout" in res_put_unauthorized.text

        # 3. IDOR on DELETE: User B attempts to delete User A's workout -> 403 Forbidden
        res_delete_unauthorized = await client.delete(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_b)},
        )
        assert res_delete_unauthorized.status_code == 403
        assert "cannot access another user's workout" in res_delete_unauthorized.text

        # 4. Legitimate access: User A can successfully view workout -> 200 OK
        res_get_owner = await client.get(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_a)},
        )
        assert res_get_owner.status_code == 200
        assert res_get_owner.json()["id"] == str(workout_id)

        # 5. Legitimate modification: User A can update workout -> 200 OK
        res_put_owner = await client.put(
            f"/api/v1/workouts/{workout_id}",
            json={"type": "weighted_pull_up"},
            headers={"X-User-ID": str(user_a)},
        )
        assert res_put_owner.status_code == 200
        assert res_put_owner.json()["type"] == "weighted_pull_up"

        # 6. Legitimate deletion: User A can delete their workout -> 204 No Content
        res_delete_owner = await client.delete(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_a)},
        )
        assert res_delete_owner.status_code == 204

    # Clean up outbox entries
    async with _test_session_factory() as session:
        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        result = await session.execute(stmt)
        for ob in result.scalars().all():
            await session.delete(ob)
        await session.commit()


@pytest.mark.asyncio
async def test_idor_invalid_uuid_header_returns_400() -> None:
    """Verify that an invalid UUID string in X-User-ID header returns HTTP 400 Bad Request."""
    workout_id = uuid.uuid4()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": "admin' OR '1'='1"},
        )
    assert res.status_code == 400
    assert "Invalid UUID format in X-User-ID header" in res.text


# ==============================================================================
# 4. Security: SQL & JSONB Injection Protection Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_sql_injection_protection_in_payload() -> None:
    """Verify SQL injection attempts in string fields are safely treated as literal data."""
    user_id = uuid.uuid4()
    injection_type = "bench'; DROP TABLE test_injection_dummy; --"
    payload = {
        "user_id": str(user_id),
        "type": injection_type,
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "bench'; SELECT pg_sleep(1); --",
            "weight": 95.0,
            "sets": 3,
            "reps": 8,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
        assert res.status_code == 201
        data = res.json()
        workout_id = uuid.UUID(data["id"])
        # The payload was escaped and stored as literal string
        assert data["type"] == injection_type

    # Verify directly in DB that workouts table is completely intact
    async with _test_session_factory() as session:
        workout = await session.get(WorkoutModel, workout_id)
        assert workout is not None
        assert workout.type == injection_type
        assert workout.metrics["exercise_name"] == "bench'; SELECT pg_sleep(1); --"

        # Cleanup
        await session.delete(workout)
        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        result = await session.execute(stmt)
        for ob in result.scalars().all():
            await session.delete(ob)
        await session.commit()


@pytest.mark.asyncio
async def test_sql_injection_protection_in_query_parameters() -> None:
    """Verify SQL injection in query parameters (skip, limit, user_id) is rejected by validation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # SQL injection in skip
        res_skip = await client.get("/api/v1/workouts?skip=1; DROP TABLE workouts; --")
        assert res_skip.status_code == 422

        # SQL injection in limit
        res_limit = await client.get("/api/v1/workouts?limit=' OR 1=1 --")
        assert res_limit.status_code == 422

        # SQL injection in user_id filter
        res_uid = await client.get("/api/v1/workouts?user_id=' OR '1'='1")
        assert res_uid.status_code == 422


# ==============================================================================
# 5. Discriminated Unions API Integration & Specialized Profiles Tests
# ==============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("exercise_payload", "expected_type", "expected_metric_key", "expected_metric_val"),
    [
        (
            {
                "exercise_type": "bench_press",
                "weight": 120.0,
                "sets": 4,
                "reps": 6,
                "rpe": 8.5,
                "grip_width_cm": 81.0,
            },
            "bench_press",
            "grip_width_cm",
            81.0,
        ),
        (
            {
                "exercise_type": "benchpress",
                "weight": 95.0,
                "sets": 3,
                "reps": 10,
            },
            "benchpress",
            "weight",
            95.0,
        ),
        (
            {
                "exercise_type": "squats",
                "weight": 160.0,
                "sets": 5,
                "reps": 5,
                "stance": "wide",
            },
            "squats",
            "stance",
            "wide",
        ),
        (
            {
                "exercise_type": "squat",
                "weight": 140.0,
                "sets": 3,
                "reps": 8,
                "stance": "narrow",
            },
            "squat",
            "stance",
            "narrow",
        ),
        (
            {
                "exercise_type": "deadlift",
                "weight": 210.0,
                "sets": 2,
                "reps": 4,
                "deadlift_style": "sumo",
            },
            "deadlift",
            "deadlift_style",
            "sumo",
        ),
        (
            {
                "exercise_type": "deadlift",
                "weight": 190.0,
                "sets": 3,
                "reps": 5,
                "deadlift_style": "conventional",
            },
            "deadlift",
            "deadlift_style",
            "conventional",
        ),
        (
            {
                "exercise_type": "treadmill",
                "distance_km": 6.5,
                "duration_minutes": 32.0,
                "incline_percentage": 3.5,
                "speed_kmh": 12.0,
                "pace_min_per_km": 5.0,
            },
            "treadmill",
            "incline_percentage",
            3.5,
        ),
        (
            {
                "exercise_type": "running",
                "distance_km": 10.0,
                "duration_minutes": 52.0,
                "heart_rate": 160,
                "calories_burned": 650,
            },
            "running",
            "calories_burned",
            650,
        ),
    ],
)
async def test_specialized_exercise_metrics_api_success(
    exercise_payload: dict[str, object],
    expected_type: str,
    expected_metric_key: str,
    expected_metric_val: object,
) -> None:
    """Verify all specialized exercise types are accepted via API and produce valid outbox."""
    user_id = uuid.uuid4()
    payload = {
        "user_id": str(user_id),
        "type": expected_type,
        "date": datetime.now(UTC).isoformat(),
        "metrics": exercise_payload,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
        assert res.status_code == 201, f"Failed with {res.status_code}: {res.text}"
        data = res.json()
        workout_id = uuid.UUID(data["id"])
        assert data["metrics"]["exercise_type"] == expected_type
        assert data["metrics"][expected_metric_key] == expected_metric_val

    # Verify transactional outbox
    async with _test_session_factory() as session:
        workout = await session.get(WorkoutModel, workout_id)
        assert workout is not None

        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        result = await session.execute(stmt)
        outbox = result.scalar_one_or_none()
        assert outbox is not None
        assert outbox.event_type in ("workout.completed", "workout.created")
        assert outbox.status == "pending"
        assert outbox.payload["metrics"]["exercise_type"] == expected_type
        assert outbox.payload["metrics"][expected_metric_key] == expected_metric_val

        # Cleanup
        await session.delete(workout)
        await session.delete(outbox)
        await session.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_specialized_metrics",
    [
        # bench_press: invalid grip_width_cm (<= 0)
        {
            "exercise_type": "bench_press",
            "weight": 100.0,
            "sets": 3,
            "reps": 5,
            "grip_width_cm": 0.0,
        },
        {
            "exercise_type": "bench_press",
            "weight": 100.0,
            "sets": 3,
            "reps": 5,
            "grip_width_cm": -10.0,
        },
        # bench_press: extra forbidden field
        {
            "exercise_type": "bench_press",
            "weight": 100.0,
            "sets": 3,
            "reps": 5,
            "extra_field": "disallowed",
        },
        # squats: invalid stance
        {
            "exercise_type": "squats",
            "weight": 120.0,
            "sets": 3,
            "reps": 5,
            "stance": "ultra_wide",
        },
        # squats: extra forbidden field
        {
            "exercise_type": "squats",
            "weight": 120.0,
            "sets": 3,
            "reps": 5,
            "extra_field": "disallowed",
        },
        # deadlift: invalid deadlift_style
        {
            "exercise_type": "deadlift",
            "weight": 150.0,
            "sets": 3,
            "reps": 5,
            "deadlift_style": "romanian",
        },
        # deadlift: extra forbidden field
        {
            "exercise_type": "deadlift",
            "weight": 150.0,
            "sets": 3,
            "reps": 5,
            "extra_field": "disallowed",
        },
        # treadmill: incline out of bounds (< 0 or > 40)
        {
            "exercise_type": "treadmill",
            "distance_km": 5.0,
            "duration_minutes": 25.0,
            "incline_percentage": -1.0,
        },
        {
            "exercise_type": "treadmill",
            "distance_km": 5.0,
            "duration_minutes": 25.0,
            "incline_percentage": 41.0,
        },
        # treadmill: speed_kmh <= 0
        {
            "exercise_type": "treadmill",
            "distance_km": 5.0,
            "duration_minutes": 25.0,
            "speed_kmh": 0.0,
        },
        # treadmill: pace_min_per_km <= 0
        {
            "exercise_type": "treadmill",
            "distance_km": 5.0,
            "duration_minutes": 25.0,
            "pace_min_per_km": -2.0,
        },
        # treadmill: extra forbidden field
        {
            "exercise_type": "treadmill",
            "distance_km": 5.0,
            "duration_minutes": 25.0,
            "extra_field": "disallowed",
        },
        # running: extra forbidden field
        {
            "exercise_type": "running",
            "distance_km": 5.0,
            "duration_minutes": 25.0,
            "extra_field": "disallowed",
        },
    ],
)
async def test_specialized_exercise_metrics_api_validation_errors(
    invalid_specialized_metrics: dict[str, object],
) -> None:
    """Verify that invalid specialized metrics and extra fields are rejected with 422."""
    payload = {
        "user_id": str(uuid.uuid4()),
        "type": "exercise_test",
        "date": datetime.now(UTC).isoformat(),
        "metrics": invalid_specialized_metrics,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
    assert res.status_code == 422, (
        f"Expected 422 for metrics: {invalid_specialized_metrics}, got {res.status_code}"
    )


@pytest.mark.asyncio
async def test_api_backward_compatibility_exercise_field_normalization() -> None:
    """Verify API normalizes legacy 'exercise' field to 'exercise_type' and saves to DB & outbox."""
    user_id = uuid.uuid4()
    payload = {
        "user_id": str(user_id),
        "type": "bench_press",
        "date": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise": "bench_press",
            "weight": 105.0,
            "sets": 3,
            "reps": 8,
            "grip_width_cm": 75.0,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
        assert res.status_code == 201, f"Failed with {res.status_code}: {res.text}"
        data = res.json()
        workout_id = uuid.UUID(data["id"])
        assert data["metrics"]["exercise_type"] == "bench_press"
        assert data["metrics"]["weight"] == 105.0

    async with _test_session_factory() as session:
        workout = await session.get(WorkoutModel, workout_id)
        assert workout is not None
        assert workout.metrics["exercise_type"] == "bench_press"

        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        result = await session.execute(stmt)
        outbox = result.scalar_one_or_none()
        assert outbox is not None
        assert outbox.payload["metrics"]["exercise_type"] == "bench_press"

        # Cleanup
        await session.delete(workout)
        await session.delete(outbox)
        await session.commit()
