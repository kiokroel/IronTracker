from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from workout_service.src import app, get_settings
from workout_service.src.dependencies import JWT_ALGORITHM, JWT_SECRET_KEY, get_db, get_db_session

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
async def test_list_exercises_anonymous_returns_system_exercises() -> None:
    """Anonymous athlete can list standard system exercises without auth."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/api/v1/exercises")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 8
        for exercise in data:
            assert exercise["is_custom"] is False
            assert exercise["user_id"] is None
            assert "name" in exercise
            assert "target_muscle_groups" in exercise


@pytest.mark.asyncio
async def test_create_custom_exercise_and_isolation() -> None:
    """Athlete can create custom exercise, which is isolated from other users."""
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    token_a = _generate_jwt_token(user_a)
    token_b = _generate_jwt_token(user_b)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # 1. Unauthenticated creation must fail
        unauth_resp = await client.post(
            "/api/v1/exercises",
            json={
                "name": "Фронтальный присед на груди",
                "category": "strength",
                "target_muscle_groups": ["legs", "core"],
                "equipment": "barbell",
            },
        )
        assert unauth_resp.status_code == 401

        # 2. Athlete A creates custom exercise
        create_resp = await client.post(
            "/api/v1/exercises",
            headers={"Authorization": f"Bearer {token_a}"},
            json={
                "name": "Фронтальный присед на груди",
                "category": "strength",
                "target_muscle_groups": ["legs", "core"],
                "equipment": "barbell",
            },
        )
        assert create_resp.status_code == 201
        created_data = create_resp.json()
        exercise_id = created_data["id"]
        assert created_data["is_custom"] is True
        assert created_data["user_id"] == str(user_a)
        assert created_data["name"] == "Фронтальный присед на груди"

        # 3. Listing for Athlete A includes the custom exercise
        list_a = await client.get(
            "/api/v1/exercises",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert list_a.status_code == 200
        names_a = [e["name"] for e in list_a.json()]
        assert "Фронтальный присед на груди" in names_a

        # 4. Listing for Athlete B does NOT include Athlete A's custom exercise
        list_b = await client.get(
            "/api/v1/exercises",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert list_b.status_code == 200
        names_b = [e["name"] for e in list_b.json()]
        assert "Фронтальный присед на груди" not in names_b

        # 5. only_my_custom flag returns only user's personal exercises
        custom_only_a = await client.get(
            "/api/v1/exercises?only_my_custom=true",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert custom_only_a.status_code == 200
        items = custom_only_a.json()
        assert len(items) >= 1
        for item in items:
            assert item["is_custom"] is True
            assert item["user_id"] == str(user_a)

        # Cleanup created exercise
        del_resp = await client.delete(
            f"/api/v1/exercises/{exercise_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_idor_protection_on_get_and_delete() -> None:
    """Verify IDOR protections: cannot delete or inspect another athlete's custom exercise."""
    owner_id = uuid.uuid4()
    attacker_id = uuid.uuid4()
    owner_token = _generate_jwt_token(owner_id)
    attacker_token = _generate_jwt_token(attacker_id)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # 1. Owner creates custom exercise
        create_resp = await client.post(
            "/api/v1/exercises",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={
                "name": "Секретный жим с бруска",
                "category": "strength",
                "target_muscle_groups": ["chest", "arms"],
                "equipment": "barbell",
            },
        )
        assert create_resp.status_code == 201
        exercise_id = create_resp.json()["id"]

        # 2. Attacker attempts to GET owner's private custom exercise -> 403 Forbidden
        idor_get_resp = await client.get(
            f"/api/v1/exercises/{exercise_id}",
            headers={"Authorization": f"Bearer {attacker_token}"},
        )
        assert idor_get_resp.status_code == 403
        assert "Access denied" in idor_get_resp.json()["detail"]

        # 3. Attacker attempts to DELETE owner's custom exercise -> 403 Forbidden
        idor_del_resp = await client.delete(
            f"/api/v1/exercises/{exercise_id}",
            headers={"Authorization": f"Bearer {attacker_token}"},
        )
        assert idor_del_resp.status_code == 403
        assert "Access denied" in idor_del_resp.json()["detail"]

        # 4. Attempt to delete standard system exercise -> 403 Forbidden
        # ID of standard Bench Press from migration
        system_bench_id = "11111111-1111-1111-1111-111111110001"
        system_del_resp = await client.delete(
            f"/api/v1/exercises/{system_bench_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert system_del_resp.status_code == 403
        assert "Cannot delete standard system exercises" in system_del_resp.json()["detail"]

        # 5. Owner successfully deletes their own exercise
        owner_del_resp = await client.delete(
            f"/api/v1/exercises/{exercise_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert owner_del_resp.status_code == 204

        # 6. Subsequent GET returns 404 Not Found
        get_after_del = await client.get(
            f"/api/v1/exercises/{exercise_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert get_after_del.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_custom_exercise_name_conflict() -> None:
    """Creating custom exercises with duplicate names for same user returns 409 Conflict."""
    user_id = uuid.uuid4()
    token = _generate_jwt_token(user_id)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        resp1 = await client.post(
            "/api/v1/exercises",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Шраги с гантелями стоя",
                "category": "strength",
                "target_muscle_groups": ["back", "shoulders"],
                "equipment": "dumbbell",
            },
        )
        assert resp1.status_code == 201
        exercise_id = resp1.json()["id"]

        # Duplicate attempt
        resp2 = await client.post(
            "/api/v1/exercises",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Шраги с гантелями стоя",
                "category": "strength",
                "target_muscle_groups": ["back", "shoulders"],
                "equipment": "dumbbell",
            },
        )
        assert resp2.status_code == 409
        assert "already exists in your library" in resp2.json()["detail"]

        # Clean up
        await client.delete(
            f"/api/v1/exercises/{exercise_id}",
            headers={"Authorization": f"Bearer {token}"},
        )


@pytest.mark.asyncio
async def test_exercise_filtering_by_category_muscle_and_search() -> None:
    """Filter exercises by category, muscle group, equipment, and search substring."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # Category filter
        cardio_resp = await client.get("/api/v1/exercises?category=cardio")
        assert cardio_resp.status_code == 200
        cardio_items = cardio_resp.json()
        assert len(cardio_items) >= 2
        for item in cardio_items:
            assert item["category"] == "cardio"

        # Muscle group filter (e.g. chest)
        chest_resp = await client.get("/api/v1/exercises?muscle_group=chest")
        assert chest_resp.status_code == 200
        chest_items = chest_resp.json()
        assert len(chest_items) >= 1
        for item in chest_items:
            assert "chest" in item["target_muscle_groups"]

        # Equipment filter
        barbell_resp = await client.get("/api/v1/exercises?equipment=barbell")
        assert barbell_resp.status_code == 200
        barbell_items = barbell_resp.json()
        assert len(barbell_items) >= 4
        for item in barbell_items:
            assert item["equipment"] == "barbell"

        # Search filter
        search_resp = await client.get("/api/v1/exercises?search=тяга")
        assert search_resp.status_code == 200
        search_items = search_resp.json()
        assert len(search_items) >= 2
        for item in search_items:
            assert "тяга" in item["name"].lower()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_payload",
    [
        # Name too short (<2 chars)
        {"name": "A", "category": "strength", "target_muscle_groups": ["chest"]},
        # Invalid category
        {"name": "Invalid Cat", "category": "crossfit", "target_muscle_groups": ["chest"]},
        # Invalid target muscle group
        {"name": "Invalid Muscle", "category": "strength", "target_muscle_groups": ["biceps"]},
        # Invalid equipment
        {
            "name": "Invalid Equip",
            "category": "strength",
            "target_muscle_groups": ["chest"],
            "equipment": "kettlebell_unknown",
        },
    ],
)
async def test_create_custom_exercise_validation_rejections(
    invalid_payload: dict[str, object],
) -> None:
    """Exercise creation with invalid schemas or fields must return 422 Unprocessable Entity."""
    user_id = uuid.uuid4()
    token = _generate_jwt_token(user_id)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        resp = await client.post(
            "/api/v1/exercises",
            headers={"Authorization": f"Bearer {token}"},
            json=invalid_payload,
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_unauthorized_and_nonexistent_exercise_operations() -> None:
    """Verify 401 Unauthorized for unauth DELETE and 404 for non-existent exercises."""
    user_id = uuid.uuid4()
    token = _generate_jwt_token(user_id)
    random_id = uuid.uuid4()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # 1. Unauthenticated DELETE -> 401
        del_unauth = await client.delete(f"/api/v1/exercises/{random_id}")
        assert del_unauth.status_code == 401

        # 2. Non-existent exercise GET -> 404
        get_nonexistent = await client.get(
            f"/api/v1/exercises/{random_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_nonexistent.status_code == 404

        # 3. Non-existent exercise DELETE -> 404
        del_nonexistent = await client.delete(
            f"/api/v1/exercises/{random_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_nonexistent.status_code == 404


@pytest.mark.asyncio
async def test_exercise_query_injection_safety() -> None:
    """Verify parameters are safely escaped and SQL injection attempts do not compromise DB."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        # SQL injection attempt in search query
        injection_search = "'; DROP TABLE exercises; --"
        resp = await client.get(f"/api/v1/exercises?search={injection_search}")
        assert resp.status_code == 200
        assert resp.json() == []

        # SQL injection attempt in muscle group query
        injection_muscle = "' OR 1=1; --"
        resp_muscle = await client.get(f"/api/v1/exercises?muscle_group={injection_muscle}")
        assert resp_muscle.status_code == 200
        assert resp_muscle.json() == []
