from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from workout_service.src import OutboxModel, WorkoutModel, app, get_settings
from workout_service.src.dependencies import get_db, get_db_session

# Test database connection pool with NullPool for transaction and connection isolation
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
# 1. Complete User Flow: Strength Exercise Life Cycle
# ==============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("base_prefix", ["/api/v1/workouts"])
async def test_workout_user_flow_strength_journey_e2e(base_prefix: str) -> None:
    """E2E Test: Full User Journey for Strength Workout.

    Flow:
    1. POST /api/v1/workouts (Create Strength workout with JSONB validation).
    2. Check Outbox: atomic event 'workout.created' with status 'pending'.
    3. GET /api/v1/workouts/{id} (Fetch workout by ID with X-User-ID header).
    4. GET /api/v1/workouts (Query list with user_id filter and pagination).
    5. PUT /api/v1/workouts/{id} (Full update and check outbox 'workout.updated').
    6. PATCH /api/v1/workouts/{id} (Partial update and check outbox 'workout.updated').
    7. DELETE /api/v1/workouts/{id} (Delete and check outbox 'workout.deleted').
    8. GET /api/v1/workouts/{id} -> 404 Not Found.
    """
    user_id = uuid.uuid4()
    workout_time = datetime.now(UTC)

    create_payload: dict[str, Any] = {
        "user_id": str(user_id),
        "type": "bench_press",
        "date": workout_time.isoformat(),
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
        # Step 1: Create workout
        res_create = await client.post(base_prefix, json=create_payload)
        assert res_create.status_code == 201, f"Create failed: {res_create.text}"
        data_create = res_create.json()
        workout_id = uuid.UUID(data_create["id"])

        assert data_create["user_id"] == str(user_id)
        assert data_create["type"] == "bench_press"
        assert data_create["metrics"]["exercise_type"] == "strength"
        assert data_create["metrics"]["exercise_name"] == "bench_press"
        assert data_create["metrics"]["weight"] == 120.0
        assert data_create["metrics"]["sets"] == 4
        assert data_create["metrics"]["reps"] == 6
        assert data_create["metrics"]["rpe"] == 8.5

        # Step 2: Verify atomic Outbox event generation in PostgreSQL
        async with _test_session_factory() as session:
            stmt = select(OutboxModel).where(
                OutboxModel.payload["workout_id"].as_string() == str(workout_id),
                OutboxModel.event_type.in_(("workout.created", "workout.completed")),
            )
            outbox_create = (await session.execute(stmt)).scalar_one_or_none()
            assert outbox_create is not None, "Outbox event for workout creation was not found"
            assert outbox_create.status == "pending"
            assert outbox_create.retry_count == 0
            assert outbox_create.payload["workout_id"] == str(workout_id)
            assert outbox_create.payload["user_id"] == str(user_id)
            assert outbox_create.payload["metrics"]["weight"] == 120.0

        # Step 3: Fetch workout by ID
        res_get = await client.get(
            f"{base_prefix}/{workout_id}",
            headers={"X-User-ID": str(user_id)},
        )
        assert res_get.status_code == 200
        data_get = res_get.json()
        assert data_get["id"] == str(workout_id)
        assert data_get["type"] == "bench_press"
        assert data_get["metrics"]["weight"] == 120.0

        # Step 4: List workouts for user
        res_list = await client.get(f"{base_prefix}?user_id={user_id}&skip=0&limit=10")
        assert res_list.status_code == 200
        items_list = res_list.json()
        assert len(items_list) >= 1
        assert any(item["id"] == str(workout_id) for item in items_list)

        # Step 5: Full update via PUT
        put_payload: dict[str, Any] = {
            "type": "incline_bench_press",
            "metrics": {
                "exercise_type": "strength",
                "exercise_name": "incline_bench_press",
                "weight": 125.0,
                "sets": 4,
                "reps": 5,
                "rpe": 9.0,
            },
        }
        res_put = await client.put(
            f"{base_prefix}/{workout_id}",
            json=put_payload,
            headers={"X-User-ID": str(user_id)},
        )
        assert res_put.status_code == 200, f"PUT failed: {res_put.text}"
        data_put = res_put.json()
        assert data_put["type"] == "incline_bench_press"
        assert data_put["metrics"]["weight"] == 125.0
        assert data_put["metrics"]["reps"] == 5

        # Verify Outbox for PUT update
        async with _test_session_factory() as session:
            stmt_put = select(OutboxModel).where(
                OutboxModel.payload["workout_id"].as_string() == str(workout_id),
                OutboxModel.event_type == "workout.updated",
            )
            outbox_updates = list((await session.execute(stmt_put)).scalars().all())
            assert len(outbox_updates) == 1
            assert outbox_updates[0].status == "pending"
            assert "type" in outbox_updates[0].payload["updated_fields"]
            assert "metrics" in outbox_updates[0].payload["updated_fields"]
            assert outbox_updates[0].payload["type"] == "incline_bench_press"

        # Step 6: Partial update via PATCH
        patch_payload: dict[str, Any] = {
            "type": "paused_bench_press",
        }
        res_patch = await client.patch(
            f"{base_prefix}/{workout_id}",
            json=patch_payload,
            headers={"X-User-ID": str(user_id)},
        )
        assert res_patch.status_code == 200, f"PATCH failed: {res_patch.text}"
        data_patch = res_patch.json()
        assert data_patch["type"] == "paused_bench_press"
        assert data_patch["metrics"]["weight"] == 125.0  # Preserved from previous PUT

        # Verify Outbox for PATCH update (should now have 2 update events)
        async with _test_session_factory() as session:
            stmt_patch = select(OutboxModel).where(
                OutboxModel.payload["workout_id"].as_string() == str(workout_id),
                OutboxModel.event_type == "workout.updated",
            )
            outbox_updates_patch = list((await session.execute(stmt_patch)).scalars().all())
            assert len(outbox_updates_patch) == 2
            for ob in outbox_updates_patch:
                assert ob.status == "pending"

        # Step 7: Delete workout
        res_delete = await client.delete(
            f"{base_prefix}/{workout_id}",
            headers={"X-User-ID": str(user_id)},
        )
        assert res_delete.status_code == 204

        # Verify Outbox for deletion
        async with _test_session_factory() as session:
            stmt_del = select(OutboxModel).where(
                OutboxModel.payload["workout_id"].as_string() == str(workout_id),
                OutboxModel.event_type == "workout.deleted",
            )
            outbox_del = (await session.execute(stmt_del)).scalar_one_or_none()
            assert outbox_del is not None
            assert outbox_del.status == "pending"
            assert outbox_del.payload["workout_id"] == str(workout_id)

        # Step 8: Verify 404 on subsequent GET
        res_get_deleted = await client.get(
            f"{base_prefix}/{workout_id}",
            headers={"X-User-ID": str(user_id)},
        )
        assert res_get_deleted.status_code == 404

    # DB Final state validation and cleanup
    async with _test_session_factory() as cleanup_session:
        # Workout row must be completely removed
        persisted = await cleanup_session.get(WorkoutModel, workout_id)
        assert persisted is None, "Deleted workout must not exist in workouts table"

        # Cleanup outbox messages created during this test
        stmt_cleanup = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        all_outbox = list((await cleanup_session.execute(stmt_cleanup)).scalars().all())
        assert len(all_outbox) == 4  # 1 created + 2 updated + 1 deleted
        for ob in all_outbox:
            await cleanup_session.delete(ob)
        await cleanup_session.commit()


# ==============================================================================
# 2. Complete User Flow: Cardio Exercise Life Cycle
# ==============================================================================


@pytest.mark.asyncio
async def test_workout_user_flow_cardio_journey_e2e() -> None:
    """E2E Test: Full User Journey for Cardio Workout with JSONB validation & Outbox.

    Flow:
    1. POST /api/v1/workouts (Create Cardio workout: distance, duration, HR).
    2. Check Outbox: 'workout.created' with status 'pending'.
    3. GET /api/v1/workouts/{id} (Validate cardio fields).
    4. PATCH /api/v1/workouts/{id} (Increase distance).
    5. Check Outbox: 'workout.updated'.
    6. DELETE /api/v1/workouts/{id}.
    7. Check Outbox: 'workout.deleted' and verify GET returns 404.
    """
    user_id = uuid.uuid4()
    now = datetime.now(UTC)

    cardio_payload: dict[str, Any] = {
        "user_id": str(user_id),
        "type": "outdoor_run",
        "date": now.isoformat(),
        "metrics": {
            "exercise_type": "cardio",
            "exercise_name": "outdoor_run",
            "distance_km": 10.5,
            "duration_minutes": 52.5,
            "heart_rate": 156,
            "calories_burned": 620,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create cardio workout
        res_create = await client.post("/api/v1/workouts", json=cardio_payload)
        assert res_create.status_code == 201
        data = res_create.json()
        workout_id = uuid.UUID(data["id"])
        assert data["metrics"]["exercise_type"] == "cardio"
        assert data["metrics"]["distance_km"] == 10.5
        assert data["metrics"]["duration_minutes"] == 52.5
        assert data["metrics"]["heart_rate"] == 156

        # 2. Outbox check for creation
        async with _test_session_factory() as session:
            stmt = select(OutboxModel).where(
                OutboxModel.payload["workout_id"].as_string() == str(workout_id),
                OutboxModel.event_type.in_(("workout.created", "workout.completed")),
            )
            outbox_entry = (await session.execute(stmt)).scalar_one_or_none()
            assert outbox_entry is not None
            assert outbox_entry.status == "pending"
            assert outbox_entry.payload["metrics"]["distance_km"] == 10.5

        # 3. Read back
        res_get = await client.get(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_id)},
        )
        assert res_get.status_code == 200
        assert res_get.json()["metrics"]["duration_minutes"] == 52.5

        # 4. Partial update via PATCH
        patch_payload: dict[str, Any] = {
            "metrics": {
                "exercise_type": "cardio",
                "exercise_name": "outdoor_run",
                "distance_km": 12.0,
                "duration_minutes": 58.0,
                "heart_rate": 160,
                "calories_burned": 710,
            }
        }
        res_patch = await client.patch(
            f"/api/v1/workouts/{workout_id}",
            json=patch_payload,
            headers={"X-User-ID": str(user_id)},
        )
        assert res_patch.status_code == 200
        assert res_patch.json()["metrics"]["distance_km"] == 12.0

        # 5. Outbox check for update
        async with _test_session_factory() as session:
            stmt_upd = select(OutboxModel).where(
                OutboxModel.payload["workout_id"].as_string() == str(workout_id),
                OutboxModel.event_type == "workout.updated",
            )
            outbox_upd = (await session.execute(stmt_upd)).scalar_one_or_none()
            assert outbox_upd is not None
            assert outbox_upd.status == "pending"
            assert outbox_upd.payload["metrics"]["distance_km"] == 12.0

        # 6. Delete cardio workout
        res_del = await client.delete(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_id)},
        )
        assert res_del.status_code == 204

        # 7. Check 404
        res_404 = await client.get(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_id)},
        )
        assert res_404.status_code == 404

    # Cleanup
    async with _test_session_factory() as session:
        stmt_clean = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        for ob in (await session.execute(stmt_clean)).scalars().all():
            await session.delete(ob)
        await session.commit()


# ==============================================================================
# 3. User Flow: Pagination, Filtering & User Isolation
# ==============================================================================


@pytest.mark.asyncio
async def test_workout_user_flow_pagination_and_user_filter_e2e() -> None:
    """E2E Test: Verify pagination (skip, limit) and user_id filtering for multiple users."""
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    now = datetime.now(UTC)

    created_ids: list[uuid.UUID] = []
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create 3 workouts for User A
        for i in range(3):
            payload_a = {
                "user_id": str(user_a),
                "type": f"strength_a_{i}",
                "date": now.isoformat(),
                "metrics": {
                    "exercise_type": "strength",
                    "exercise_name": f"exercise_a_{i}",
                    "weight": 100.0 + i * 5,
                    "sets": 3,
                    "reps": 8,
                },
            }
            res = await client.post("/api/v1/workouts", json=payload_a)
            assert res.status_code == 201
            created_ids.append(uuid.UUID(res.json()["id"]))

        # Create 2 workouts for User B
        for j in range(2):
            payload_b = {
                "user_id": str(user_b),
                "type": f"cardio_b_{j}",
                "date": now.isoformat(),
                "metrics": {
                    "exercise_type": "cardio",
                    "exercise_name": f"cardio_b_{j}",
                    "distance_km": 5.0 + j,
                    "duration_minutes": 25.0 + j,
                },
            }
            res = await client.post("/api/v1/workouts", json=payload_b)
            assert res.status_code == 201
            created_ids.append(uuid.UUID(res.json()["id"]))

        # Test Filter by user_a: returns exactly 3
        res_a = await client.get(f"/api/v1/workouts?user_id={user_a}")
        assert res_a.status_code == 200
        list_a = res_a.json()
        assert len(list_a) == 3
        assert all(item["user_id"] == str(user_a) for item in list_a)

        # Test Pagination on user_a: skip=0, limit=2
        res_page_1 = await client.get(f"/api/v1/workouts?user_id={user_a}&skip=0&limit=2")
        assert res_page_1.status_code == 200
        assert len(res_page_1.json()) == 2

        # Test Pagination on user_a: skip=2, limit=2
        res_page_2 = await client.get(f"/api/v1/workouts?user_id={user_a}&skip=2&limit=2")
        assert res_page_2.status_code == 200
        assert len(res_page_2.json()) == 1

        # Test Filter by user_b: returns exactly 2
        res_b = await client.get(f"/api/v1/workouts?user_id={user_b}")
        assert res_b.status_code == 200
        list_b = res_b.json()
        assert len(list_b) == 2
        assert all(item["user_id"] == str(user_b) for item in list_b)

        # Test boundary pagination: skip beyond count returns empty list
        res_empty = await client.get(f"/api/v1/workouts?user_id={user_a}&skip=10&limit=10")
        assert res_empty.status_code == 200
        assert res_empty.json() == []

    # Cleanup workouts and outbox rows
    async with _test_session_factory() as session:
        for w_id in created_ids:
            w_obj = await session.get(WorkoutModel, w_id)
            if w_obj:
                await session.delete(w_obj)

            stmt_ob = select(OutboxModel).where(
                OutboxModel.payload["workout_id"].as_string() == str(w_id)
            )
            for ob in (await session.execute(stmt_ob)).scalars().all():
                await session.delete(ob)
        await session.commit()


# ==============================================================================
# 4. Security & IDOR (Insecure Direct Object Reference) Protection Flow
# ==============================================================================


@pytest.mark.asyncio
async def test_workout_user_flow_idor_protection_e2e() -> None:
    """E2E Test: Verify strict IDOR access control across all endpoints.

    Scenario:
    - User A (Owner) creates a workout.
    - User B (Attacker) attempts to:
        * GET User A's workout -> 403 Forbidden
        * PUT User A's workout -> 403 Forbidden
        * PATCH User A's workout -> 403 Forbidden
        * DELETE User A's workout -> 403 Forbidden
    - Verify workout remains unchanged and no fraudulent outbox entries exist.
    - User A can legitimately read, update, and delete the workout.
    """
    user_owner = uuid.uuid4()
    user_attacker = uuid.uuid4()
    now = datetime.now(UTC)

    create_payload = {
        "user_id": str(user_owner),
        "type": "deadlift",
        "date": now.isoformat(),
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "deadlift",
            "weight": 210.0,
            "sets": 3,
            "reps": 3,
            "rpe": 9.0,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Owner creates workout
        res_create = await client.post("/api/v1/workouts", json=create_payload)
        assert res_create.status_code == 201
        workout_id = uuid.UUID(res_create.json()["id"])

        # Step 2: Attacker attempts IDOR on GET -> 403 Forbidden
        res_idor_get = await client.get(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_attacker)},
        )
        assert res_idor_get.status_code == 403
        assert "cannot access another user's workout" in res_idor_get.text

        # Step 3: Attacker attempts IDOR on PUT -> 403 Forbidden
        res_idor_put = await client.put(
            f"/api/v1/workouts/{workout_id}",
            json={
                "type": "tampered_type",
                "metrics": {
                    "exercise_type": "strength",
                    "exercise_name": "tampered",
                    "weight": 1.0,
                    "sets": 1,
                    "reps": 1,
                },
            },
            headers={"X-User-ID": str(user_attacker)},
        )
        assert res_idor_put.status_code == 403
        assert "cannot access another user's workout" in res_idor_put.text

        # Step 4: Attacker attempts IDOR on PATCH -> 403 Forbidden
        res_idor_patch = await client.patch(
            f"/api/v1/workouts/{workout_id}",
            json={"type": "tampered_patch"},
            headers={"X-User-ID": str(user_attacker)},
        )
        assert res_idor_patch.status_code == 403
        assert "cannot access another user's workout" in res_idor_patch.text

        # Step 5: Attacker attempts IDOR on DELETE -> 403 Forbidden
        res_idor_del = await client.delete(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_attacker)},
        )
        assert res_idor_del.status_code == 403
        assert "cannot access another user's workout" in res_idor_del.text

        # Step 6: Verify in PostgreSQL that workout data remains completely intact
        async with _test_session_factory() as session:
            obj = await session.get(WorkoutModel, workout_id)
            assert obj is not None
            assert obj.type == "deadlift"
            assert obj.metrics["weight"] == 210.0

            # Verify no updated or deleted outbox events were recorded
            stmt = select(OutboxModel).where(
                OutboxModel.payload["workout_id"].as_string() == str(workout_id),
                OutboxModel.event_type.in_(("workout.updated", "workout.deleted")),
            )
            fraudulent_events = list((await session.execute(stmt)).scalars().all())
            assert len(fraudulent_events) == 0

        # Step 7: Legitimate owner updates and deletes workout
        res_owner_patch = await client.patch(
            f"/api/v1/workouts/{workout_id}",
            json={"type": "deadlift_pr"},
            headers={"X-User-ID": str(user_owner)},
        )
        assert res_owner_patch.status_code == 200
        assert res_owner_patch.json()["type"] == "deadlift_pr"

        res_owner_del = await client.delete(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_owner)},
        )
        assert res_owner_del.status_code == 204

    # Cleanup
    async with _test_session_factory() as session:
        stmt_cleanup = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        for ob in (await session.execute(stmt_cleanup)).scalars().all():
            await session.delete(ob)
        await session.commit()


# ==============================================================================
# 5. Negative Scenarios: Discriminated Unions & JSONB Validation
# ==============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("invalid_metrics", "expected_status"),
    [
        # Missing discriminator
        ({"weight": 100.0, "sets": 3, "reps": 10}, 422),
        # Invalid discriminator
        ({"exercise_type": "unsupported_discipline", "weight": 100.0}, 422),
        # Negative weight in strength
        (
            {
                "exercise_type": "strength",
                "exercise_name": "bench",
                "weight": -50.0,
                "sets": 3,
                "reps": 10,
            },
            422,
        ),
        # Zero weight in strength (gt=0 requirement)
        (
            {
                "exercise_type": "strength",
                "exercise_name": "bench",
                "weight": 0.0,
                "sets": 3,
                "reps": 10,
            },
            422,
        ),
        # Zero sets
        (
            {
                "exercise_type": "strength",
                "exercise_name": "bench",
                "weight": 100.0,
                "sets": 0,
                "reps": 10,
            },
            422,
        ),
        # Negative reps
        (
            {
                "exercise_type": "strength",
                "exercise_name": "bench",
                "weight": 100.0,
                "sets": 3,
                "reps": -5,
            },
            422,
        ),
        # RPE > 10.0
        (
            {
                "exercise_type": "strength",
                "exercise_name": "bench",
                "weight": 100.0,
                "sets": 3,
                "reps": 5,
                "rpe": 10.5,
            },
            422,
        ),
        # RPE < 1.0
        (
            {
                "exercise_type": "strength",
                "exercise_name": "bench",
                "weight": 100.0,
                "sets": 3,
                "reps": 5,
                "rpe": 0.5,
            },
            422,
        ),
        # Extra forbidden field in strength (extra="forbid")
        (
            {
                "exercise_type": "strength",
                "exercise_name": "bench",
                "weight": 100.0,
                "sets": 3,
                "reps": 5,
                "unknown_key": "injected",
            },
            422,
        ),
        # Negative distance in cardio
        (
            {
                "exercise_type": "cardio",
                "exercise_name": "run",
                "distance_km": -5.0,
                "duration_minutes": 30.0,
            },
            422,
        ),
        # Zero duration in cardio
        (
            {
                "exercise_type": "cardio",
                "exercise_name": "run",
                "distance_km": 5.0,
                "duration_minutes": 0.0,
            },
            422,
        ),
        # Negative heart rate in cardio
        (
            {
                "exercise_type": "cardio",
                "exercise_name": "run",
                "distance_km": 5.0,
                "duration_minutes": 30.0,
                "heart_rate": -120,
            },
            422,
        ),
    ],
)
async def test_workout_user_flow_negative_validation_jsonb_e2e(
    invalid_metrics: dict[str, Any],
    expected_status: int,
) -> None:
    """Verify that malformed JSONB metrics fail Pydantic validation with HTTP 422."""
    payload = {
        "user_id": str(uuid.uuid4()),
        "type": "validation_test",
        "date": datetime.now(UTC).isoformat(),
        "metrics": invalid_metrics,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=payload)
        assert res.status_code == expected_status, (
            f"Expected {expected_status} for {invalid_metrics}, got {res.status_code}: {res.text}"
        )


@pytest.mark.asyncio
async def test_workout_user_flow_negative_validation_on_update_e2e() -> None:
    """Verify that attempting to update with invalid JSONB metrics fails with 422."""
    user_id = uuid.uuid4()
    now = datetime.now(UTC)

    create_payload = {
        "user_id": str(user_id),
        "type": "bench_press",
        "date": now.isoformat(),
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "bench_press",
            "weight": 100.0,
            "sets": 3,
            "reps": 10,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_create = await client.post("/api/v1/workouts", json=create_payload)
        assert res_create.status_code == 201
        workout_id = uuid.UUID(res_create.json()["id"])

        # Attempt PUT with negative weight
        bad_put = {
            "metrics": {
                "exercise_type": "strength",
                "exercise_name": "bench_press",
                "weight": -99.0,
                "sets": 3,
                "reps": 10,
            }
        }
        res_bad_put = await client.put(
            f"/api/v1/workouts/{workout_id}",
            json=bad_put,
            headers={"X-User-ID": str(user_id)},
        )
        assert res_bad_put.status_code == 422

        # Attempt PATCH with negative reps
        bad_patch = {
            "metrics": {
                "exercise_type": "strength",
                "exercise_name": "bench_press",
                "weight": 100.0,
                "sets": 3,
                "reps": -1,
            }
        }
        res_bad_patch = await client.patch(
            f"/api/v1/workouts/{workout_id}",
            json=bad_patch,
            headers={"X-User-ID": str(user_id)},
        )
        assert res_bad_patch.status_code == 422

        # Clean up via DELETE
        res_del = await client.delete(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": str(user_id)},
        )
        assert res_del.status_code == 204

    # Clean up outbox
    async with _test_session_factory() as session:
        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        for ob in (await session.execute(stmt)).scalars().all():
            await session.delete(ob)
        await session.commit()


@pytest.mark.asyncio
async def test_workout_user_flow_header_and_path_validation_e2e() -> None:
    """Verify bad UUID format in URL path returns 422 and invalid X-User-ID returns 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Invalid UUID in path param
        res_bad_path = await client.get("/api/v1/workouts/not-a-valid-uuid")
        assert res_bad_path.status_code == 422

        # Invalid UUID format in X-User-ID header
        workout_id = uuid.uuid4()
        res_bad_header = await client.get(
            f"/api/v1/workouts/{workout_id}",
            headers={"X-User-ID": "invalid-uuid-string-test"},
        )
        assert res_bad_header.status_code == 400
        assert "Invalid UUID format in X-User-ID header" in res_bad_header.text


# ==============================================================================
# 6. Transactional Outbox Atomic Rollback Guarantees
# ==============================================================================


@pytest.mark.asyncio
async def test_workout_user_flow_atomic_rollback_on_create_failure_e2e() -> None:
    """Verify that a database failure on create rolls back atomically with no orphan outbox."""
    user_id = uuid.uuid4()
    payload = {
        "user_id": str(user_id),
        "type": "rollback_test",
        "date": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "bench",
            "weight": 100.0,
            "sets": 3,
            "reps": 5,
        },
    }

    with patch(
        "workout_service.src.controllers.workout.WorkoutRepository.create_workout_with_outbox",
        side_effect=RuntimeError("Simulated database failure during creation"),
    ):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/v1/workouts", json=payload)
            assert res.status_code == 500

    # Ensure neither workout nor outbox record was written
    async with _test_session_factory() as session:
        stmt_w = select(WorkoutModel).where(WorkoutModel.user_id == user_id)
        assert len(list((await session.execute(stmt_w)).scalars().all())) == 0

        stmt_o = select(OutboxModel).where(
            OutboxModel.payload["user_id"].as_string() == str(user_id)
        )
        assert len(list((await session.execute(stmt_o)).scalars().all())) == 0


@pytest.mark.asyncio
async def test_workout_user_flow_atomic_rollback_on_update_failure_e2e() -> None:
    """Verify that an update failure rolls back atomically, leaving original workout intact."""
    user_id = uuid.uuid4()
    now = datetime.now(UTC)

    create_payload = {
        "user_id": str(user_id),
        "type": "bench_original",
        "date": now.isoformat(),
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "bench_press",
            "weight": 100.0,
            "sets": 3,
            "reps": 10,
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/workouts", json=create_payload)
        assert res.status_code == 201
        workout_id = uuid.UUID(res.json()["id"])

    # Attempt failing update
    with patch(
        "workout_service.src.controllers.workout.WorkoutRepository.update_workout_with_outbox",
        side_effect=RuntimeError("Simulated update failure"),
    ):
        transport_fail = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport_fail, base_url="http://test") as client:
            res_fail = await client.patch(
                f"/api/v1/workouts/{workout_id}",
                json={"type": "tampered_bench"},
                headers={"X-User-ID": str(user_id)},
            )
            assert res_fail.status_code == 500

    # Verify original workout remains unchanged and no workout.updated event exists
    async with _test_session_factory() as session:
        workout = await session.get(WorkoutModel, workout_id)
        assert workout is not None
        assert workout.type == "bench_original"

        stmt_upd = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id),
            OutboxModel.event_type == "workout.updated",
        )
        assert len(list((await session.execute(stmt_upd)).scalars().all())) == 0

        # Cleanup
        await session.delete(workout)
        stmt_cleanup = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        for ob in (await session.execute(stmt_cleanup)).scalars().all():
            await session.delete(ob)
        await session.commit()
