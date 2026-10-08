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

from shared.contracts.src.metrics import StrengthExerciseMetrics
from workout_service.src import OutboxModel, WorkoutModel, app, get_settings
from workout_service.src.controllers.workout import WorkoutController
from workout_service.src.dependencies import get_db, get_db_session
from workout_service.src.repositories.workout import WorkoutRepository
from workout_service.src.schemas.workout import WorkoutCreate, WorkoutUpdate

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


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "endpoint",
    [
        "/workouts",
        "/workouts/",
        "/api/workouts",
        "/api/workouts/",
        "/api/v1/workouts",
        "/api/v1/workouts/",
    ],
)
async def test_create_workout_all_endpoint_variants_and_outbox(endpoint: str) -> None:
    """Verify POST on all route variants creates workout and outbox event with status 'pending'."""
    user_id = uuid.uuid4()
    payload = {
        "user_id": str(user_id),
        "type": "bench_press",
        "date": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "bench_press",
            "weight": 120.0,
            "sets": 4,
            "reps": 6,
            "rpe": 8.5,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(endpoint, json=payload)
        assert res.status_code == 201, f"Failed for endpoint {endpoint}: {res.text}"
        data = res.json()
        workout_id = uuid.UUID(data["id"])
        assert data["type"] == "bench_press"
        assert data["user_id"] == str(user_id)
        assert data["metrics"]["weight"] == 120.0

    # Verify atomic persistence in PostgreSQL
    async with _test_session_factory() as session:
        workout = await session.get(WorkoutModel, workout_id)
        assert workout is not None
        assert workout.user_id == user_id
        assert workout.type == "bench_press"
        assert workout.metrics["weight"] == 120.0

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
        assert ("completed_at" in outbox_entry.payload) or ("created_at" in outbox_entry.payload)
        assert "occurred_at" in outbox_entry.payload
        assert outbox_entry.payload["metrics"]["weight"] == 120.0

        # Cleanup
        await session.delete(workout)
        await session.delete(outbox_entry)
        await session.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize("base_path", ["/workouts", "/api/workouts", "/api/v1/workouts"])
async def test_list_workouts_pagination_and_filter(base_path: str) -> None:
    """Verify GET list endpoints support pagination (skip, limit) and filtering by user_id."""
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    now = datetime.now(UTC)

    async with _test_session_factory() as session:
        workouts_to_create = [
            WorkoutModel(
                id=uuid.uuid4(),
                user_id=user_a,
                date=now,
                type="squat",
                metrics={
                    "exercise_type": "strength",
                    "exercise_name": "squat",
                    "weight": 140.0 + i,
                    "sets": 3,
                    "reps": 5,
                },
                created_at=now,
            )
            for i in range(3)
        ]
        other_workout = WorkoutModel(
            id=uuid.uuid4(),
            user_id=user_b,
            date=now,
            type="deadlift",
            metrics={
                "exercise_type": "strength",
                "exercise_name": "deadlift",
                "weight": 200.0,
                "sets": 1,
                "reps": 5,
            },
            created_at=now,
        )
        for w in workouts_to_create + [other_workout]:
            session.add(w)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Filter by user_a
        res_user_a = await client.get(f"{base_path}?user_id={user_a}")
        assert res_user_a.status_code == 200
        items_a = res_user_a.json()
        assert len(items_a) == 3
        for item in items_a:
            assert item["user_id"] == str(user_a)

        # Pagination test on base_path/
        res_paginated = await client.get(f"{base_path}/?user_id={user_a}&skip=1&limit=2")
        assert res_paginated.status_code == 200
        items_paginated = res_paginated.json()
        assert len(items_paginated) == 2

    # Cleanup
    async with _test_session_factory() as session:
        for w in workouts_to_create + [other_workout]:
            obj = await session.get(WorkoutModel, w.id)
            if obj:
                await session.delete(obj)
        await session.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize("prefix", ["/workouts", "/api/workouts"])
async def test_get_workout_by_id_endpoints_and_idor(prefix: str) -> None:
    """Verify GET /{id} on both prefixes with IDOR checks and 404 handling."""
    user_owner = uuid.uuid4()
    user_attacker = uuid.uuid4()
    now = datetime.now(UTC)
    workout_id = uuid.uuid4()

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_owner,
            date=now,
            type="bench_press",
            metrics={
                "exercise_type": "strength",
                "exercise_name": "bench_press",
                "weight": 115.0,
                "sets": 3,
                "reps": 8,
            },
            created_at=now,
        )
        session.add(workout)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. 200 OK for owner
        res_owner = await client.get(
            f"{prefix}/{workout_id}",
            headers={"X-User-ID": str(user_owner)},
        )
        assert res_owner.status_code == 200
        assert res_owner.json()["id"] == str(workout_id)

        # 2. 403 Forbidden for mismatched user
        res_attacker = await client.get(
            f"{prefix}/{workout_id}",
            headers={"X-User-ID": str(user_attacker)},
        )
        assert res_attacker.status_code == 403

        # 3. 404 Not Found for non-existent ID
        res_not_found = await client.get(f"{prefix}/{uuid.uuid4()}")
        assert res_not_found.status_code == 404

    # Cleanup
    async with _test_session_factory() as session:
        obj = await session.get(WorkoutModel, workout_id)
        if obj:
            await session.delete(obj)
        await session.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize("prefix", ["/workouts", "/api/workouts"])
async def test_update_workout_endpoints_and_outbox_and_idor(prefix: str) -> None:
    """Verify PUT /{id} updates workout, creates outbox event, and enforces IDOR."""
    user_owner = uuid.uuid4()
    user_attacker = uuid.uuid4()
    now = datetime.now(UTC)
    workout_id = uuid.uuid4()

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_owner,
            date=now,
            type="squat",
            metrics={
                "exercise_type": "strength",
                "exercise_name": "squat",
                "weight": 130.0,
                "sets": 3,
                "reps": 5,
            },
            created_at=now,
        )
        session.add(workout)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        update_payload = {
            "type": "paused_squat",
            "metrics": {
                "exercise_type": "strength",
                "exercise_name": "paused_squat",
                "weight": 135.0,
                "sets": 3,
                "reps": 5,
                "rpe": 8.0,
            },
        }

        # 1. 403 Forbidden for mismatched user
        res_attacker = await client.put(
            f"{prefix}/{workout_id}",
            json=update_payload,
            headers={"X-User-ID": str(user_attacker)},
        )
        assert res_attacker.status_code == 403

        # 2. 404 Not Found for non-existent ID
        res_not_found = await client.put(
            f"{prefix}/{uuid.uuid4()}",
            json=update_payload,
            headers={"X-User-ID": str(user_owner)},
        )
        assert res_not_found.status_code == 404

        # 3. 200 OK for owner
        res_owner = await client.put(
            f"{prefix}/{workout_id}",
            json=update_payload,
            headers={"X-User-ID": str(user_owner)},
        )
        assert res_owner.status_code == 200
        assert res_owner.json()["type"] == "paused_squat"
        assert res_owner.json()["metrics"]["weight"] == 135.0

    # Verify update in DB and outbox
    async with _test_session_factory() as session:
        updated_workout = await session.get(WorkoutModel, workout_id)
        assert updated_workout is not None
        assert updated_workout.type == "paused_squat"

        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id),
            OutboxModel.event_type == "workout.updated",
        )
        result = await session.execute(stmt)
        outbox_entry = result.scalar_one_or_none()

        assert outbox_entry is not None
        assert outbox_entry.status == "pending"
        assert outbox_entry.retry_count == 0
        assert outbox_entry.payload["workout_id"] == str(workout_id)
        assert outbox_entry.payload["user_id"] == str(user_owner)
        assert "type" in outbox_entry.payload["updated_fields"]
        assert "metrics" in outbox_entry.payload["updated_fields"]

        # Cleanup
        await session.delete(updated_workout)
        await session.delete(outbox_entry)
        await session.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize("prefix", ["/workouts", "/api/workouts"])
async def test_delete_workout_endpoints_and_outbox_and_idor(prefix: str) -> None:
    """Verify DELETE /{id} removes workout, creates outbox event, and enforces IDOR."""
    user_owner = uuid.uuid4()
    user_attacker = uuid.uuid4()
    now = datetime.now(UTC)
    workout_id = uuid.uuid4()

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_owner,
            date=now,
            type="deadlift",
            metrics={
                "exercise_type": "strength",
                "exercise_name": "deadlift",
                "weight": 180.0,
                "sets": 1,
                "reps": 5,
            },
            created_at=now,
        )
        session.add(workout)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. 403 Forbidden for mismatched user
        res_attacker = await client.delete(
            f"{prefix}/{workout_id}",
            headers={"X-User-ID": str(user_attacker)},
        )
        assert res_attacker.status_code == 403

        # 2. 404 Not Found for non-existent ID
        res_not_found = await client.delete(
            f"{prefix}/{uuid.uuid4()}",
            headers={"X-User-ID": str(user_owner)},
        )
        assert res_not_found.status_code == 404

        # 3. 204 No Content for owner
        res_owner = await client.delete(
            f"{prefix}/{workout_id}",
            headers={"X-User-ID": str(user_owner)},
        )
        assert res_owner.status_code == 204

    # Verify deletion in DB and outbox record
    async with _test_session_factory() as session:
        deleted_workout = await session.get(WorkoutModel, workout_id)
        assert deleted_workout is None

        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id),
            OutboxModel.event_type == "workout.deleted",
        )
        result = await session.execute(stmt)
        outbox_entry = result.scalar_one_or_none()

        assert outbox_entry is not None
        assert outbox_entry.status == "pending"
        assert outbox_entry.retry_count == 0
        assert outbox_entry.payload["workout_id"] == str(workout_id)
        assert outbox_entry.payload["user_id"] == str(user_owner)

        # Cleanup
        await session.delete(outbox_entry)
        await session.commit()


@pytest.mark.asyncio
async def test_backward_compatibility_workout_created_event() -> None:
    """Verify repository supports workout.created event type for backward compatibility."""
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    dto = WorkoutCreate(
        user_id=user_id,
        type="deadlift",
        date=now,
        metrics=StrengthExerciseMetrics(
            exercise_name="deadlift",
            weight=190.0,
            sets=3,
            reps=3,
        ),
    )

    async with _test_session_factory() as session:
        repo = WorkoutRepository(session)
        workout, outbox = await repo.create_workout_with_outbox(dto, event_type="workout.created")

        assert workout.id is not None
        assert outbox.event_type == "workout.created"
        assert outbox.status == "pending"
        assert outbox.retry_count == 0
        assert outbox.payload["workout_id"] == str(workout.id)
        assert outbox.payload["user_id"] == str(user_id)
        assert "created_at" in outbox.payload
        assert outbox.payload["metrics"]["weight"] == 190.0

        # Also verify controller supports passing event_type
        controller = WorkoutController(session)
        workout_c = await controller.create_workout(dto, event_type="workout.created")
        assert workout_c.id is not None

        # Cleanup
        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string().in_([str(workout.id), str(workout_c.id)])
        )
        result = await session.execute(stmt)
        for ob in result.scalars().all():
            await session.delete(ob)

        w1 = await session.get(WorkoutModel, workout.id)
        if w1:
            await session.delete(w1)
        w2 = await session.get(WorkoutModel, workout_c.id)
        if w2:
            await session.delete(w2)
        await session.commit()


@pytest.mark.asyncio
async def test_transactional_outbox_atomic_rollback_on_failure() -> None:
    """Verify that when a database error occurs, neither workout nor outbox entry is committed."""
    user_id = uuid.uuid4()
    dto = WorkoutCreate(
        user_id=user_id,
        type="squat",
        date=datetime.now(UTC),
        metrics=StrengthExerciseMetrics(
            exercise_name="squat",
            weight=150.0,
            sets=5,
            reps=5,
        ),
    )

    async with _test_session_factory() as session:
        repo = WorkoutRepository(session)
        with patch.object(
            session, "commit", side_effect=RuntimeError("Simulated database failure")
        ):
            with pytest.raises(RuntimeError, match="Simulated database failure"):
                await repo.create_workout_with_outbox(dto)
            await session.rollback()

    # Verify no orphan outbox entry or workout exists
    async with _test_session_factory() as verify_session:
        stmt_outbox = select(OutboxModel).where(
            OutboxModel.payload["user_id"].as_string() == str(user_id)
        )
        res_outbox = await verify_session.execute(stmt_outbox)
        assert len(list(res_outbox.scalars().all())) == 0

        stmt_workout = select(WorkoutModel).where(WorkoutModel.user_id == user_id)
        res_workout = await verify_session.execute(stmt_workout)
        assert len(list(res_workout.scalars().all())) == 0


@pytest.mark.asyncio
async def test_transactional_outbox_update_atomic_rollback_on_failure() -> None:
    """Verify update failure rolls back atomically, preserving original state and no outbox."""
    user_id = uuid.uuid4()
    workout_id = uuid.uuid4()
    now = datetime.now(UTC)

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_id,
            date=now,
            type="bench_press",
            metrics={
                "exercise_type": "strength",
                "exercise_name": "bench_press",
                "weight": 100.0,
                "sets": 3,
                "reps": 10,
            },
            created_at=now,
        )
        session.add(workout)
        await session.commit()

    update_dto = WorkoutUpdate(
        type="incline_bench_press",
        metrics=StrengthExerciseMetrics(
            exercise_name="incline_bench_press",
            weight=110.0,
            sets=4,
            reps=8,
        ),
    )

    async with _test_session_factory() as session:
        repo = WorkoutRepository(session)
        db_obj = await repo.get(workout_id)
        assert db_obj is not None
        with patch.object(
            session, "commit", side_effect=RuntimeError("Simulated update commit failure")
        ):
            with pytest.raises(RuntimeError, match="Simulated update commit failure"):
                await repo.update_workout_with_outbox(db_obj, update_dto)
            await session.rollback()

    async with _test_session_factory() as verify_session:
        refreshed = await verify_session.get(WorkoutModel, workout_id)
        assert refreshed is not None
        assert refreshed.type == "bench_press"
        assert refreshed.metrics["weight"] == 100.0

        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id),
            OutboxModel.event_type == "workout.updated",
        )
        result = await verify_session.execute(stmt)
        assert len(list(result.scalars().all())) == 0

        # Cleanup
        await verify_session.delete(refreshed)
        await verify_session.commit()


@pytest.mark.asyncio
async def test_transactional_outbox_delete_atomic_rollback_on_failure() -> None:
    """Verify delete failure rolls back atomically, preserving workout and no outbox."""
    user_id = uuid.uuid4()
    workout_id = uuid.uuid4()
    now = datetime.now(UTC)

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_id,
            date=now,
            type="deadlift",
            metrics={
                "exercise_type": "strength",
                "exercise_name": "deadlift",
                "weight": 180.0,
                "sets": 2,
                "reps": 5,
            },
            created_at=now,
        )
        session.add(workout)
        await session.commit()

    async with _test_session_factory() as session:
        repo = WorkoutRepository(session)
        with patch.object(
            session, "commit", side_effect=RuntimeError("Simulated delete commit failure")
        ):
            with pytest.raises(RuntimeError, match="Simulated delete commit failure"):
                await repo.delete_workout_with_outbox(workout_id)
            await session.rollback()

    async with _test_session_factory() as verify_session:
        persisted = await verify_session.get(WorkoutModel, workout_id)
        assert persisted is not None
        assert persisted.type == "deadlift"

        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id),
            OutboxModel.event_type == "workout.deleted",
        )
        result = await verify_session.execute(stmt)
        assert len(list(result.scalars().all())) == 0

        # Cleanup
        await verify_session.delete(persisted)
        await verify_session.commit()


@pytest.mark.asyncio
async def test_api_create_workout_rollback_prevents_phantom_records() -> None:
    """Verify API POST failure prevents phantom records in both workouts and outbox tables."""
    user_id = uuid.uuid4()
    payload = {
        "user_id": str(user_id),
        "type": "squat",
        "date": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "squat",
            "weight": 160.0,
            "sets": 5,
            "reps": 5,
        },
    }

    with patch(
        "workout_service.src.controllers.workout.WorkoutRepository.create_workout_with_outbox",
        side_effect=RuntimeError("Database write failure"),
    ):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/workouts/", json=payload)
            assert res.status_code == 500

    async with _test_session_factory() as session:
        stmt_w = select(WorkoutModel).where(WorkoutModel.user_id == user_id)
        res_w = await session.execute(stmt_w)
        assert len(list(res_w.scalars().all())) == 0

        stmt_o = select(OutboxModel).where(
            OutboxModel.payload["user_id"].as_string() == str(user_id)
        )
        res_o = await session.execute(stmt_o)
        assert len(list(res_o.scalars().all())) == 0


@pytest.mark.asyncio
async def test_api_update_workout_rollback_prevents_phantom_outbox() -> None:
    """Verify API PUT failure rolls back and prevents phantom workout.updated outbox entries."""
    user_id = uuid.uuid4()
    workout_id = uuid.uuid4()
    now = datetime.now(UTC)

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_id,
            date=now,
            type="bench_press",
            metrics={
                "exercise_type": "strength",
                "exercise_name": "bench_press",
                "weight": 90.0,
                "sets": 3,
                "reps": 10,
            },
            created_at=now,
        )
        session.add(workout)
        await session.commit()

    update_payload = {
        "type": "close_grip_bench",
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "close_grip_bench",
            "weight": 85.0,
            "sets": 3,
            "reps": 10,
        },
    }

    with patch(
        "workout_service.src.controllers.workout.WorkoutRepository.update_workout_with_outbox",
        side_effect=RuntimeError("Update flush failed"),
    ):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.put(
                f"/api/workouts/{workout_id}",
                json=update_payload,
                headers={"X-User-ID": str(user_id)},
            )
            assert res.status_code == 500

    async with _test_session_factory() as session:
        obj = await session.get(WorkoutModel, workout_id)
        assert obj is not None
        assert obj.type == "bench_press"

        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id),
            OutboxModel.event_type == "workout.updated",
        )
        stmt_result = await session.execute(stmt)
        assert len(list(stmt_result.scalars().all())) == 0

        # Cleanup
        await session.delete(obj)
        await session.commit()


@pytest.mark.asyncio
async def test_api_delete_workout_rollback_prevents_phantom_outbox() -> None:
    """Verify API DELETE failure rolls back and preserves workout and leaves no delete outbox."""
    user_id = uuid.uuid4()
    workout_id = uuid.uuid4()
    now = datetime.now(UTC)

    async with _test_session_factory() as session:
        workout = WorkoutModel(
            id=workout_id,
            user_id=user_id,
            date=now,
            type="deadlift",
            metrics={
                "exercise_type": "strength",
                "exercise_name": "deadlift",
                "weight": 200.0,
                "sets": 1,
                "reps": 5,
            },
            created_at=now,
        )
        session.add(workout)
        await session.commit()

    with patch(
        "workout_service.src.controllers.workout.WorkoutRepository.delete_workout_with_outbox",
        side_effect=RuntimeError("Delete commit failed"),
    ):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.delete(
                f"/api/workouts/{workout_id}",
                headers={"X-User-ID": str(user_id)},
            )
            assert res.status_code == 500

    async with _test_session_factory() as session:
        obj = await session.get(WorkoutModel, workout_id)
        assert obj is not None

        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id),
            OutboxModel.event_type == "workout.deleted",
        )
        stmt_result = await session.execute(stmt)
        assert len(list(stmt_result.scalars().all())) == 0

        # Cleanup
        await session.delete(obj)
        await session.commit()
