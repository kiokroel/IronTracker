from __future__ import annotations

import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from shared.contracts.src import (
    CardioExerciseMetrics,
    StrengthExerciseMetrics,
)
from workout_service.src import (
    OutboxModel,
    WorkoutModel,
    app,
    get_settings,
)
from workout_service.src.controllers.workout import WorkoutController
from workout_service.src.dependencies import (
    get_db,
    get_db_session,
    get_optional_user_id,
)
from workout_service.src.repositories.base import BaseRepository
from workout_service.src.repositories.workout import WorkoutRepository
from workout_service.src.schemas.workout import (
    WorkoutCreate,
    WorkoutUpdate,
)

_test_engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
_test_session_factory = async_sessionmaker(
    bind=_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.mark.asyncio
async def test_schemas_discriminated_unions_validation() -> None:
    """Verify strict validation and Discriminated Unions parsing in workout schemas."""
    user_id = uuid.uuid4()

    # Valid strength metrics
    strength_metrics = StrengthExerciseMetrics(
        exercise_name="bench_press",
        weight=105.0,
        sets=4,
        reps=8,
        rpe=8.0,
    )
    create_dto = WorkoutCreate(
        user_id=user_id,
        type="bench_press",
        metrics=strength_metrics,
    )
    assert create_dto.type == "bench_press"
    assert isinstance(create_dto.metrics, StrengthExerciseMetrics)
    assert create_dto.metrics.weight == 105.0

    # Valid cardio metrics
    cardio_metrics = CardioExerciseMetrics(
        exercise_name="cycling",
        distance_km=15.5,
        duration_minutes=45.0,
        heart_rate=140,
    )
    create_cardio_dto = WorkoutCreate(
        user_id=user_id,
        type="cycling",
        metrics=cardio_metrics,
    )
    assert isinstance(create_cardio_dto.metrics, CardioExerciseMetrics)
    assert create_cardio_dto.metrics.distance_km == 15.5

    # Invalid discriminator or metric values
    with pytest.raises(ValidationError):
        WorkoutCreate.model_validate(
            {
                "user_id": str(user_id),
                "type": "invalid",
                "metrics": {
                    "exercise_type": "unknown",
                    "foo": "bar",
                },
            }
        )

    # Negative weight rejected
    with pytest.raises(ValidationError):
        WorkoutCreate.model_validate(
            {
                "user_id": str(user_id),
                "type": "strength",
                "metrics": {
                    "exercise_type": "strength",
                    "exercise_name": "press",
                    "weight": -5.0,
                    "sets": 3,
                    "reps": 5,
                },
            }
        )


@pytest.mark.asyncio
async def test_base_repository_crud() -> None:
    """Verify generic BaseRepository CRUD operations on WorkoutModel."""
    async with _test_session_factory() as session:
        base_repo = BaseRepository[WorkoutModel, WorkoutCreate, WorkoutUpdate](
            session, WorkoutModel
        )

        user_id = uuid.uuid4()
        metrics = StrengthExerciseMetrics(
            exercise_name="squat",
            weight=130.0,
            sets=3,
            reps=5,
        )
        create_dto = WorkoutCreate(
            user_id=user_id,
            type="squat",
            metrics=metrics,
        )

        # Create
        created = await base_repo.create(create_dto)
        assert created.id is not None
        assert created.user_id == user_id
        workout_id = created.id

        # Get by ID
        fetched = await base_repo.get(workout_id)
        assert fetched is not None
        assert fetched.id == workout_id

        # Get all
        all_items = await base_repo.get_all(skip=0, limit=10)
        assert any(item.id == workout_id for item in all_items)

        # Update
        update_dto = WorkoutUpdate(type="box_squat")
        updated = await base_repo.update(fetched, update_dto)
        assert updated.type == "box_squat"

        # Delete
        deleted = await base_repo.delete(workout_id)
        assert deleted is True

        # Verify gone
        assert await base_repo.get(workout_id) is None


@pytest.mark.asyncio
async def test_workout_repository_transactional_outbox() -> None:
    """Verify WorkoutRepository atomically persists workout and outbox events."""
    async with _test_session_factory() as session:
        repo = WorkoutRepository(session)
        user_id = uuid.uuid4()
        metrics = StrengthExerciseMetrics(
            exercise_name="deadlift",
            weight=170.0,
            sets=3,
            reps=3,
            rpe=9.0,
        )
        dto = WorkoutCreate(
            user_id=user_id,
            type="deadlift",
            metrics=metrics,
        )

        workout, outbox = await repo.create_workout_with_outbox(dto)
        assert workout.id is not None
        assert outbox.id is not None
        assert outbox.event_type in ("workout.completed", "workout.created")
        assert outbox.payload["workout_id"] == str(workout.id)
        assert outbox.payload["metrics"]["weight"] == 170.0
        assert outbox.status == "pending"

        # Query workouts by user ID
        user_workouts = await repo.get_by_user_id(user_id)
        assert len(user_workouts) >= 1
        assert user_workouts[0].id == workout.id

        # Update workout with outbox
        new_metrics = StrengthExerciseMetrics(
            exercise_name="deadlift",
            weight=175.0,
            sets=3,
            reps=3,
            rpe=9.5,
        )
        update_dto = WorkoutUpdate(metrics=new_metrics)
        updated_workout, update_outbox = await repo.update_workout_with_outbox(workout, update_dto)
        assert updated_workout.metrics["weight"] == 175.0
        assert update_outbox.event_type == "workout.updated"
        assert update_outbox.payload["workout_id"] == str(workout.id)

        # Delete workout with outbox
        deleted = await repo.delete_workout_with_outbox(workout.id)
        assert deleted is True
        assert await repo.get_by_id(workout.id) is None

        # Clean up outbox entries
        stmt = select(OutboxModel).where(OutboxModel.id.in_([outbox.id, update_outbox.id]))
        res = await session.execute(stmt)
        for ob in res.scalars().all():
            await session.delete(ob)
        await session.commit()


@pytest.mark.asyncio
async def test_workout_controller_workflow() -> None:
    """Verify WorkoutController business logic and error handling."""
    async with _test_session_factory() as session:
        controller = WorkoutController(session)
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()

        metrics = CardioExerciseMetrics(
            exercise_name="running",
            distance_km=7.5,
            duration_minutes=38.0,
            heart_rate=150,
        )
        dto = WorkoutCreate(
            user_id=user_id,
            type="running",
            metrics=metrics,
        )

        workout = await controller.create_workout(dto)
        assert workout.id is not None
        workout_id = workout.id

        # Get workout
        fetched = await controller.get_workout(workout_id, current_user_id=user_id)
        assert fetched.id == workout_id

        # IDOR check: accessing with another user_id should raise 403
        with pytest.raises(HTTPException) as exc_info:
            await controller.get_workout(workout_id, current_user_id=other_user_id)
        assert exc_info.value.status_code == 403

        # Nonexistent workout raises 404
        with pytest.raises(HTTPException) as exc_404:
            await controller.get_workout(uuid.uuid4())
        assert exc_404.value.status_code == 404

        # List user workouts
        user_list = await controller.get_user_workouts(user_id=user_id)
        assert any(w.id == workout_id for w in user_list)

        # Update workout
        update_dto = WorkoutUpdate(type="trail_running")
        updated = await controller.update_workout(
            workout_id=workout_id,
            workout_update=update_dto,
            current_user_id=user_id,
        )
        assert updated.type == "trail_running"

        # Delete workout
        await controller.delete_workout(workout_id=workout_id, current_user_id=user_id)

        # Verify deletion raises 404
        with pytest.raises(HTTPException) as exc_deleted:
            await controller.get_workout(workout_id)
        assert exc_deleted.value.status_code == 404


@pytest.mark.asyncio
async def test_workout_api_endpoints_via_async_client() -> None:
    """Verify /api/v1/workouts endpoints using httpx.AsyncClient with mock DB session."""
    workout_id = uuid.uuid4()
    mock_session = AsyncMock(spec=AsyncSession)

    async def override_get_db() -> AsyncMock:
        return mock_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_db_session] = override_get_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Test POST /api/v1/workouts with invalid payload (422)
            res_invalid = await client.post(
                "/api/v1/workouts",
                json={"type": "invalid"},
            )
            assert res_invalid.status_code == 422

            # 2. Test dependencies.get_optional_user_id
            res_invalid_header = await client.get(
                f"/api/v1/workouts/{workout_id}",
                headers={"X-User-ID": "invalid-uuid"},
            )
            assert res_invalid_header.status_code == 400

            # 3. Test GET /health and /ready
            res_health = await client.get("/health")
            assert res_health.status_code == 200
            assert res_health.json()["status"] == "ok"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_optional_user_id_dependency() -> None:
    """Verify get_optional_user_id dependency returns correct values."""
    assert await get_optional_user_id(None) is None

    test_uuid = uuid.uuid4()
    parsed = await get_optional_user_id(str(test_uuid))
    assert parsed == test_uuid

    with pytest.raises(HTTPException) as exc_info:
        await get_optional_user_id("not-a-valid-uuid")
    assert exc_info.value.status_code == 400


def test_no_unsafe_functions_in_workout_service() -> None:
    """Verify that dangerous functions (eval, exec, pickle, os.system) are absent."""
    forbidden_keywords = ["eval(", "exec(", "pickle.loads", "os.system(", "subprocess.Popen("]
    base_dir = Path(__file__).resolve().parent.parent / "workout_service"

    for file_path in base_dir.rglob("*.py"):
        content = file_path.read_text(encoding="utf-8")
        for forbidden in forbidden_keywords:
            assert forbidden not in content, (
                f"Forbidden security vulnerability '{forbidden}' found in {file_path}"
            )


@pytest.mark.asyncio
async def test_base_repository_rollback_on_commit_failure() -> None:
    """Verify BaseRepository rollback on commit failure for create, update, and delete."""
    user_id = uuid.uuid4()
    dto = WorkoutCreate(
        user_id=user_id,
        type="deadlift",
        metrics=StrengthExerciseMetrics(
            exercise_name="deadlift",
            weight=150.0,
            sets=3,
            reps=5,
        ),
    )

    # 1. Test create rollback
    async with _test_session_factory() as session:
        repo = BaseRepository[WorkoutModel, WorkoutCreate, WorkoutUpdate](session, WorkoutModel)
        with patch.object(session, "commit", side_effect=RuntimeError("Create commit fail")):
            with patch.object(session, "rollback", wraps=session.rollback) as mock_rollback:
                with pytest.raises(RuntimeError, match="Create commit fail"):
                    await repo.create(dto)
                mock_rollback.assert_awaited_once()

    # Verify nothing was persisted
    async with _test_session_factory() as session:
        stmt = select(WorkoutModel).where(WorkoutModel.user_id == user_id)
        res = await session.execute(stmt)
        assert len(list(res.scalars().all())) == 0

    # Create real workout for update & delete rollback tests
    async with _test_session_factory() as session:
        repo = BaseRepository[WorkoutModel, WorkoutCreate, WorkoutUpdate](session, WorkoutModel)
        workout = await repo.create(dto)
        workout_id = workout.id

    # 2. Test update rollback
    async with _test_session_factory() as session:
        repo = BaseRepository[WorkoutModel, WorkoutCreate, WorkoutUpdate](session, WorkoutModel)
        db_workout = await repo.get(workout_id)
        assert db_workout is not None
        update_dto = WorkoutUpdate(type="sumo_deadlift")
        with patch.object(session, "commit", side_effect=RuntimeError("Update commit fail")):
            with patch.object(session, "rollback", wraps=session.rollback) as mock_rollback:
                with pytest.raises(RuntimeError, match="Update commit fail"):
                    await repo.update(db_workout, update_dto)
                mock_rollback.assert_awaited_once()

    # Verify type was not changed in DB
    async with _test_session_factory() as session:
        fetched = await session.get(WorkoutModel, workout_id)
        assert fetched is not None
        assert fetched.type == "deadlift"

    # 3. Test delete rollback
    async with _test_session_factory() as session:
        repo = BaseRepository[WorkoutModel, WorkoutCreate, WorkoutUpdate](session, WorkoutModel)
        with patch.object(session, "commit", side_effect=RuntimeError("Delete commit fail")):
            with patch.object(session, "rollback", wraps=session.rollback) as mock_rollback:
                with pytest.raises(RuntimeError, match="Delete commit fail"):
                    await repo.delete(workout_id)
                mock_rollback.assert_awaited_once()

    # Verify workout still exists in DB
    async with _test_session_factory() as session:
        fetched = await session.get(WorkoutModel, workout_id)
        assert fetched is not None

        # Clean up
        await session.delete(fetched)
        await session.commit()
