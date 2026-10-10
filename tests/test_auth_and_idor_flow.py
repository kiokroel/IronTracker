from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest
from httpx import ASGITransport

from leaderboard_service.src.core.redis import close_redis_pool
from leaderboard_service.src.main import app as leaderboard_app
from users_service.src.core.database import (
    close_db_engine as close_users_db,
    init_db as init_users_db,
)
from users_service.src.main import app as users_app
from workout_service.src.core.database import engine as workout_engine
from workout_service.src.main import app as workout_app


@pytest.fixture(autouse=True)
async def init_databases_fixture() -> AsyncGenerator[None, None]:
    """Ensure database tables exist for users and workout services."""
    await init_users_db()
    yield
    await close_users_db()
    await workout_engine.dispose()
    await close_redis_pool()


@pytest.mark.asyncio
async def test_end_to_end_auth_and_idor_protection() -> None:
    """Verify registration, JWT token binding, and strict IDOR prevention across services."""
    users_transport = ASGITransport(app=users_app)
    workout_transport = ASGITransport(app=workout_app)
    lb_transport = ASGITransport(app=leaderboard_app)

    async with (
        httpx.AsyncClient(transport=users_transport, base_url="http://test-users") as users_client,
        httpx.AsyncClient(
            transport=workout_transport, base_url="http://test-workout"
        ) as workout_client,
        httpx.AsyncClient(transport=lb_transport, base_url="http://test-lb") as lb_client,
    ):
        suffix_a = uuid.uuid4().hex[:6]
        suffix_b = uuid.uuid4().hex[:6]

        email_a = f"athlete_a_{suffix_a}@irontracker.io"
        email_b = f"athlete_b_{suffix_b}@irontracker.io"
        password = "SecurePassword123!"

        # Step 1: Register User A and User B
        res_reg_a = await users_client.post(
            "/api/v1/users/register",
            json={"email": email_a, "username": f"LifterA_{suffix_a}", "password": password},
        )
        assert res_reg_a.status_code == 201
        user_a = res_reg_a.json()
        user_a_id = user_a["id"]

        res_reg_b = await users_client.post(
            "/api/v1/users/register",
            json={"email": email_b, "username": f"LifterB_{suffix_b}", "password": password},
        )
        assert res_reg_b.status_code == 201
        user_b = res_reg_b.json()
        user_b_id = user_b["id"]
        assert user_b_id != user_a_id

        # Step 2: Login User A and User B to get JWT tokens
        res_login_a = await users_client.post(
            "/api/v1/users/login",
            json={"email": email_a, "password": password},
        )
        assert res_login_a.status_code == 200
        token_a = res_login_a.json()["access_token"]

        res_login_b = await users_client.post(
            "/api/v1/users/login",
            json={"email": email_b, "password": password},
        )
        assert res_login_b.status_code == 200
        token_b = res_login_b.json()["access_token"]

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Step 3: User A creates a workout with JWT token
        # Notice: Even if body had another user_id, route binds it to current_user.id from JWT
        now_iso = datetime.now(UTC).isoformat()
        workout_payload = {
            "type": "strength",
            "user_id": user_a_id,
            "date": now_iso,
            "metrics": {
                "exercise_type": "bench_press",
                "weight": 110.0,
                "sets": 5,
                "reps": 5,
            },
        }

        res_create = await workout_client.post(
            "/api/v1/workouts",
            json=workout_payload,
            headers=headers_a,
        )
        assert res_create.status_code == 201
        workout = res_create.json()
        assert workout["user_id"] == user_a_id
        workout_id = workout["id"]

        # Step 4: IDOR Protection Verification
        # User B attempts to UPDATE User A's workout -> Must be rejected with 403 Forbidden!
        idor_update_res = await workout_client.put(
            f"/api/v1/workouts/{workout_id}",
            json={
                "metrics": {
                    "exercise_type": "bench_press",
                    "weight": 200.0,
                    "sets": 1,
                    "reps": 1,
                }
            },
            headers=headers_b,
        )
        assert idor_update_res.status_code == 403
        assert "cannot access another user's workout" in idor_update_res.json()["detail"]

        # User B attempts to DELETE User A's workout -> Must be rejected with 403 Forbidden!
        idor_delete_res = await workout_client.delete(
            f"/api/v1/workouts/{workout_id}",
            headers=headers_b,
        )
        assert idor_delete_res.status_code == 403
        assert "cannot access another user's workout" in idor_delete_res.json()["detail"]

        # Step 5: Legitimate Owner (User A) successfully updates their workout
        valid_update_res = await workout_client.put(
            f"/api/v1/workouts/{workout_id}",
            json={
                "metrics": {
                    "exercise_type": "bench_press",
                    "weight": 115.0,
                    "sets": 5,
                    "reps": 5,
                }
            },
            headers=headers_a,
        )
        assert valid_update_res.status_code == 200
        assert valid_update_res.json()["metrics"]["weight"] == 115.0

        # Step 6: Leaderboard /me endpoint verification with JWT
        lb_res = await lb_client.get(
            "/api/v1/leaderboard/me",
            headers=headers_a,
        )
        assert lb_res.status_code == 200
        lb_data = lb_res.json()
        assert lb_data["user_id"] == user_a_id
        assert "rank" in lb_data
        assert "score" in lb_data
