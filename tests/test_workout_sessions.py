from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from unittest.mock import patch

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from workout_service.src import app, get_settings
from workout_service.src.dependencies import JWT_ALGORITHM, JWT_SECRET_KEY, get_db, get_db_session
from workout_service.src.models.outbox import OutboxModel
from workout_service.src.models.workout_session import WorkoutSessionModel
from workout_service.src.repositories.workout_session import WorkoutSessionRepository
from workout_service.src.schemas.workout_session import (
    WorkoutSessionCreate,
    WorkoutSessionExerciseItem,
    WorkoutSessionSet,
)

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


def _generate_jwt_token(user_id: uuid.UUID) -> str:
    """Helper generating standard Bearer JWT token."""
    payload = {
        "sub": str(user_id),
        "email": f"athlete_{user_id.hex[:8]}@irontracker.dev",
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


@pytest.mark.asyncio
async def test_create_multi_exercise_session_and_tonnage_calculation() -> None:
    """Athlete creates a session with multiple exercises.

    Warmups are excluded from tonnage, and outbox event is written atomically.
    """
    user_id = uuid.uuid4()
    token = _generate_jwt_token(user_id)

    payload: dict[str, object] = {
        "title": "Комплексная тренировка (Грудь + Спина + Кардио)",
        "duration_minutes": 75,
        "notes": "Отличное самочувствие, целевые веса закрыты",
        "exercises": [
            {
                "exercise_name": "Жим штанги лежа",
                "exercise_type": "strength",
                "sets": [
                    {"set_number": 1, "weight": 60.0, "reps": 10, "is_warmup": True},
                    {"set_number": 2, "weight": 100.0, "reps": 5, "is_warmup": False, "rpe": 8.0},
                    {"set_number": 3, "weight": 100.0, "reps": 5, "is_warmup": False, "rpe": 8.5},
                ],
            },
            {
                "exercise_name": "Тяга штанги в наклоне",
                "exercise_type": "strength",
                "sets": [
                    {"set_number": 1, "weight": 80.0, "reps": 8, "is_warmup": False, "rpe": 7.5},
                    {"set_number": 2, "weight": 80.0, "reps": 8, "is_warmup": False, "rpe": 8.0},
                ],
            },
            {
                "exercise_name": "Беговая дорожка (заминка)",
                "exercise_type": "cardio",
                "distance_km": 3.0,
                "duration_minutes": 15.0,
                "heart_rate": 135,
                "calories_burned": 210,
            },
        ],
    }

    # Expected working tonnage:
    # Exercise 1: (100 * 5) + (100 * 5) = 1000.0 (warmup 60*10=600 is excluded)
    # Exercise 2: (80 * 8) + (80 * 8) = 1280.0
    # Total = 2280.0 kg

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/workout-sessions",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201, response.text
        data = response.json()

        assert data["title"] == payload["title"]
        assert data["duration_minutes"] == 75
        assert data["total_tonnage"] == 2280.0
        assert len(data["exercises"]) == 3
        session_id = uuid.UUID(data["id"])

        # Verify Outbox entry was created atomically in the database
        async with _test_session_factory() as db:
            outbox_stmt = select(OutboxModel).where(
                OutboxModel.event_type == "workout_session.completed",
                OutboxModel.payload["session_id"].as_string() == str(session_id),
            )
            result = await db.execute(outbox_stmt)
            outbox_entry = result.scalar_one_or_none()
            assert outbox_entry is not None
            assert outbox_entry.status == "pending"
            assert outbox_entry.payload["total_tonnage"] == 2280.0
            assert outbox_entry.payload["exercises_count"] == 3
            assert outbox_entry.payload["user_id"] == str(user_id)


@pytest.mark.asyncio
async def test_workout_session_idor_protection() -> None:
    """Verify strict IDOR protection.

    Athletes cannot read, update, or delete sessions of other athletes.
    """
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    token_a = _generate_jwt_token(user_a)
    token_b = _generate_jwt_token(user_b)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # Athlete A creates a session
        create_resp = await client.post(
            "/api/v1/workout-sessions",
            json={
                "title": "Private Session Athlete A",
                "duration_minutes": 45,
                "exercises": [
                    {
                        "exercise_name": "Приседания со штангой",
                        "exercise_type": "strength",
                        "sets": [
                            {"set_number": 1, "weight": 140.0, "reps": 5, "is_warmup": False},
                        ],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert create_resp.status_code == 201
        session_id = create_resp.json()["id"]

        # Athlete B tries to read Athlete A's session -> 403 Forbidden
        get_b_resp = await client.get(
            f"/api/v1/workout-sessions/{session_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert get_b_resp.status_code == 403
        assert "another athlete" in get_b_resp.json()["detail"].lower()

        # Athlete B tries to update Athlete A's session -> 403 Forbidden
        put_b_resp = await client.put(
            f"/api/v1/workout-sessions/{session_id}",
            json={"title": "Hacked Title"},
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert put_b_resp.status_code == 403

        # Athlete B tries to delete Athlete A's session -> 403 Forbidden
        del_b_resp = await client.delete(
            f"/api/v1/workout-sessions/{session_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert del_b_resp.status_code == 403

        # Athlete A successfully reads own session
        get_a_resp = await client.get(
            f"/api/v1/workout-sessions/{session_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert get_a_resp.status_code == 200
        assert get_a_resp.json()["id"] == session_id


@pytest.mark.asyncio
async def test_workout_session_list_isolation() -> None:
    """Athletes only receive their own sessions when listing."""
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    token_a = _generate_jwt_token(user_a)
    token_b = _generate_jwt_token(user_b)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # Create session for user A
        empty_exercises: list[dict[str, object]] = []
        await client.post(
            "/api/v1/workout-sessions",
            json={"title": "Session A", "exercises": empty_exercises},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        # Create session for user B
        await client.post(
            "/api/v1/workout-sessions",
            json={"title": "Session B", "exercises": empty_exercises},
            headers={"Authorization": f"Bearer {token_b}"},
        )

        # List user A
        resp_a = await client.get(
            "/api/v1/workout-sessions",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert resp_a.status_code == 200
        titles_a = [s["title"] for s in resp_a.json()]
        assert "Session A" in titles_a
        assert "Session B" not in titles_a


@pytest.mark.asyncio
async def test_workout_session_update_and_delete_with_outbox() -> None:
    """Updating and deleting a session recalculates tonnage.

    Records corresponding Outbox events atomically.
    """
    user_id = uuid.uuid4()
    token = _generate_jwt_token(user_id)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # 1. Create initial session
        create_resp = await client.post(
            "/api/v1/workout-sessions",
            json={
                "title": "Initial Session",
                "exercises": [
                    {
                        "exercise_name": "Жим гантелей",
                        "exercise_type": "strength",
                        "sets": [{"set_number": 1, "weight": 30.0, "reps": 10, "is_warmup": False}],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert create_resp.status_code == 201
        session_id = create_resp.json()["id"]
        assert create_resp.json()["total_tonnage"] == 300.0

        # 2. Update session with heavier sets
        update_resp = await client.put(
            f"/api/v1/workout-sessions/{session_id}",
            json={
                "title": "Updated Session",
                "exercises": [
                    {
                        "exercise_name": "Жим гантелей",
                        "exercise_type": "strength",
                        "sets": [
                            {"set_number": 1, "weight": 35.0, "reps": 10, "is_warmup": False},
                            {"set_number": 2, "weight": 35.0, "reps": 10, "is_warmup": False},
                        ],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["title"] == "Updated Session"
        assert update_resp.json()["total_tonnage"] == 700.0

        # Verify update outbox entry
        async with _test_session_factory() as db:
            update_outbox = select(OutboxModel).where(
                OutboxModel.event_type == "workout_session.updated",
                OutboxModel.payload["session_id"].as_string() == session_id,
            )
            res = await db.execute(update_outbox)
            entry = res.scalar_one_or_none()
            assert entry is not None
            assert entry.payload["total_tonnage"] == 700.0

        # 3. Delete session
        del_resp = await client.delete(
            f"/api/v1/workout-sessions/{session_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_resp.status_code == 204

        # Verify deleted in DB
        async with _test_session_factory() as db:
            stmt = select(WorkoutSessionModel).where(
                WorkoutSessionModel.id == uuid.UUID(session_id)
            )
            assert (await db.execute(stmt)).scalar_one_or_none() is None

            del_outbox = select(OutboxModel).where(
                OutboxModel.event_type == "workout_session.deleted",
                OutboxModel.payload["session_id"].as_string() == session_id,
            )
            assert (await db.execute(del_outbox)).scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_workout_session_validation_errors() -> None:
    """Invalid session data (e.g. negative weight, invalid RPE, bad discriminator).

    Returns 422 and does not create outbox entry.
    """
    user_id = uuid.uuid4()
    token = _generate_jwt_token(user_id)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # Negative weight
        resp_neg_weight = await client.post(
            "/api/v1/workout-sessions",
            json={
                "title": "Invalid Session",
                "exercises": [
                    {
                        "exercise_name": "Жим",
                        "exercise_type": "strength",
                        "sets": [{"set_number": 1, "weight": -50.0, "reps": 10}],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_neg_weight.status_code == 422

        # Invalid RPE > 10
        resp_invalid_rpe = await client.post(
            "/api/v1/workout-sessions",
            json={
                "title": "Invalid Session",
                "exercises": [
                    {
                        "exercise_name": "Жим",
                        "exercise_type": "strength",
                        "sets": [{"set_number": 1, "weight": 50.0, "reps": 10, "rpe": 15.0}],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_invalid_rpe.status_code == 422

        # Invalid exercise_type discriminator
        resp_invalid_type = await client.post(
            "/api/v1/workout-sessions",
            json={
                "title": "Invalid Type Session",
                "exercises": [
                    {
                        "exercise_name": "Жим",
                        "exercise_type": "unknown_discriminator",
                        "sets": [{"set_number": 1, "weight": 50.0, "reps": 10}],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_invalid_type.status_code == 422

        # Empty exercise_name
        resp_empty_name = await client.post(
            "/api/v1/workout-sessions",
            json={
                "title": "Invalid Name Session",
                "exercises": [
                    {
                        "exercise_name": "",
                        "exercise_type": "strength",
                        "sets": [{"set_number": 1, "weight": 50.0, "reps": 10}],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_empty_name.status_code == 422

        # Verify no outbox entries were created for this user
        async with _test_session_factory() as db:
            stmt = select(OutboxModel).where(
                OutboxModel.payload["user_id"].as_string() == str(user_id)
            )
            entries = (await db.execute(stmt)).scalars().all()
            assert len(entries) == 0


@pytest.mark.asyncio
async def test_workout_session_rollback_no_outbox() -> None:
    """If a database error occurs during session creation, transaction rolls back

    and no Outbox record is persisted.
    """
    user_id = uuid.uuid4()

    async with _test_session_factory() as db:
        repo = WorkoutSessionRepository(db)
        with patch.object(db, "commit", side_effect=RuntimeError("Simulated DB Commit Failure")):
            with pytest.raises(RuntimeError, match="Simulated DB Commit Failure"):
                await repo.create_session_with_outbox(
                    session_in=WorkoutSessionCreate(
                        title="Failed Transaction Session",
                        exercises=[
                            WorkoutSessionExerciseItem(
                                exercise_name="Rollback Press",
                                exercise_type="strength",
                                sets=[WorkoutSessionSet(set_number=1, weight=100.0, reps=5)],
                            )
                        ],
                    ),
                    user_id=user_id,
                )
        await db.rollback()

    async with _test_session_factory() as db:
        stmt = select(OutboxModel).where(OutboxModel.payload["user_id"].as_string() == str(user_id))
        res = await db.execute(stmt)
        assert res.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_workout_session_sql_injection_safety() -> None:
    """Verify safe parameterization against SQL and JSON injection attacks."""
    user_id = uuid.uuid4()
    token = _generate_jwt_token(user_id)

    injection_title = "Workout'; DROP TABLE workout_sessions; --"
    injection_exercise = "<script>alert(1)</script>' OR '1'='1"
    injection_notes = '{"admin": true, "$where": "sleep(5000)"}'

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        resp = await client.post(
            "/api/v1/workout-sessions",
            json={
                "title": injection_title,
                "notes": injection_notes,
                "exercises": [
                    {
                        "exercise_name": injection_exercise,
                        "exercise_type": "strength",
                        "sets": [{"set_number": 1, "weight": 80.0, "reps": 8}],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == injection_title
        assert data["exercises"][0]["exercise_name"] == injection_exercise
        assert data["notes"] == injection_notes

        async with _test_session_factory() as db:
            session_in_db = await db.get(WorkoutSessionModel, uuid.UUID(data["id"]))
            assert session_in_db is not None
            assert session_in_db.title == injection_title
