from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator

import httpx
import pytest
from httpx import ASGITransport

from users_service.src.core.database import close_db_engine, init_db
from users_service.src.main import app


@pytest.fixture(autouse=True)
async def setup_test_db() -> AsyncGenerator[None, None]:
    """Ensure database schema exists before tests."""
    await init_db()
    yield
    await close_db_engine()


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Yield async httpx test client for Users Service."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_users_health_and_ready(client: httpx.AsyncClient) -> None:
    """Verify health and readiness monitoring endpoints."""
    res_health = await client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json() == {"status": "ok", "service": "users"}

    res_ready = await client.get("/ready")
    assert res_ready.status_code == 200
    assert res_ready.json() == {"status": "ready", "database": "connected"}


@pytest.mark.asyncio
async def test_register_and_login_flow(client: httpx.AsyncClient) -> None:
    """Verify registration, login and profile flow."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"lifter_{unique_suffix}@irontracker.io"
    password = "SuperStrongPassword123!"
    username = f"Athlete_{unique_suffix}"

    # 1. Register new user
    reg_res = await client.post(
        "/api/v1/users/register",
        json={"email": email, "username": username, "password": password},
    )
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["email"] == email
    assert user_data["username"] == username
    assert "id" in user_data
    user_id = user_data["id"]

    # 2. Duplicate registration returns 409 Conflict
    dup_res = await client.post(
        "/api/v1/users/register",
        json={"email": email, "username": "AnotherName", "password": password},
    )
    assert dup_res.status_code == 409

    # 3. Login with wrong password returns 401
    bad_login_res = await client.post(
        "/api/v1/users/login",
        json={"email": email, "password": "WrongPassword!"},
    )
    assert bad_login_res.status_code == 401

    # 4. Login with correct password returns JWT token
    login_res = await client.post(
        "/api/v1/users/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    assert token_data["user_id"] == user_id
    access_token = token_data["access_token"]

    # 5. Get current profile with JWT
    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = await client.get("/api/v1/users/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["id"] == user_id
    assert me_data["email"] == email
    assert me_data["username"] == username

    # 6. Update profile
    new_username = f"Updated_{unique_suffix}"
    put_res = await client.put(
        "/api/v1/users/me",
        headers=headers,
        json={"username": new_username},
    )
    assert put_res.status_code == 200
    updated_data = put_res.json()
    assert updated_data["username"] == new_username


@pytest.mark.asyncio
async def test_get_profile_unauthorized(client: httpx.AsyncClient) -> None:
    """Verify accessing /me without token returns 401."""
    res = await client.get("/api/v1/users/me")
    assert res.status_code == 401

    res_invalid = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert res_invalid.status_code == 401
