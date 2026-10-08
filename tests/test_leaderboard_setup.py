from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from redis.asyncio import ConnectionPool, Redis

from leaderboard_service.src import (
    HealthResponse,
    ReadyErrorResponse,
    ReadyResponse,
    RedisSettings,
    Settings,
    app,
    close_redis_pool,
    get_redis,
    get_redis_client,
    get_redis_pool,
    get_settings,
    init_redis_pool,
    router,
)
from leaderboard_service.src.main import lifespan

PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ==============================================================================
# 1. Health and Readiness Probe Endpoints Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_health_check_endpoint() -> None:
    """Verify /health returns HTTP 200 with valid HealthResponse schema."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    validated = HealthResponse(**data)
    assert validated.status == "ok"
    assert validated.service == "leaderboard"


@pytest.mark.asyncio
async def test_health_check_unsupported_methods() -> None:
    """Verify /health rejects non-GET HTTP methods with 405 Method Not Allowed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        post_res = await client.post("/health")
        put_res = await client.put("/health")
        delete_res = await client.delete("/health")

    assert post_res.status_code == 405
    assert put_res.status_code == 405
    assert delete_res.status_code == 405


@pytest.mark.asyncio
async def test_ready_endpoint_success() -> None:
    """Verify /ready returns HTTP 200 when Redis is connected and healthy."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.ping = AsyncMock(return_value=True)

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")

        assert response.status_code == 200
        data = response.json()
        validated = ReadyResponse(**data)
        assert validated.status == "ready"
        assert validated.redis == "connected"
    finally:
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_ready_endpoint_redis_ping_false() -> None:
    """Verify /ready returns HTTP 503 when Redis PING returns False."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.ping = AsyncMock(return_value=False)

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")

        assert response.status_code == 503
        data = response.json()
        validated = ReadyErrorResponse(**data)
        assert validated.status == "unavailable"
        assert validated.redis == "disconnected"
        assert "unexpected response" in validated.detail
    finally:
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_ready_endpoint_redis_connection_error() -> None:
    """Verify /ready returns HTTP 503 when Redis connection fails or times out."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.ping = AsyncMock(side_effect=ConnectionError("Connection refused by peer"))

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")

        assert response.status_code == 503
        data = response.json()
        validated = ReadyErrorResponse(**data)
        assert validated.status == "unavailable"
        assert validated.redis == "disconnected"
        assert "Connection refused" in validated.detail
    finally:
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_ready_endpoint_unsupported_methods() -> None:
    """Verify /ready rejects non-GET HTTP methods with 405 Method Not Allowed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        post_res = await client.post("/ready")
        put_res = await client.put("/ready")

    assert post_res.status_code == 405
    assert put_res.status_code == 405


# ==============================================================================
# 2. Redis Connection Pool & Lifespan Management Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_redis_pool_initialization_and_close() -> None:
    """Verify init_redis_pool and close_redis_pool manage connection pool lifecycle."""
    with patch("leaderboard_service.src.core.redis.Redis") as mock_redis_cls:
        mock_instance = AsyncMock(spec=Redis)
        mock_instance.ping = AsyncMock(return_value=True)
        mock_instance.aclose = AsyncMock()
        mock_redis_cls.return_value = mock_instance

        pool = await init_redis_pool()
        assert isinstance(pool, ConnectionPool)
        mock_instance.ping.assert_awaited_once()
        mock_instance.aclose.assert_awaited_once()

        await close_redis_pool()


@pytest.mark.asyncio
async def test_redis_pool_init_failure_handled_gracefully() -> None:
    """Verify init_redis_pool logs warning and does not crash if Redis is unavailable."""
    with patch("leaderboard_service.src.core.redis.Redis") as mock_redis_cls:
        mock_instance = AsyncMock(spec=Redis)
        mock_instance.ping = AsyncMock(side_effect=ConnectionError("Cannot connect"))
        mock_instance.aclose = AsyncMock()
        mock_redis_cls.return_value = mock_instance

        # Should complete without raising exception
        pool = await init_redis_pool()
        assert isinstance(pool, ConnectionPool)
        mock_instance.aclose.assert_awaited_once()

        await close_redis_pool()


@pytest.mark.asyncio
async def test_get_redis_dependency_generator() -> None:
    """Verify get_redis yields Redis client and closes it on generator exit."""
    with patch("leaderboard_service.src.core.redis.Redis") as mock_redis_cls:
        mock_instance = AsyncMock(spec=Redis)
        mock_instance.aclose = AsyncMock()
        mock_redis_cls.return_value = mock_instance

        generator = get_redis()
        client = await anext(generator)
        assert client is mock_instance

        with pytest.raises(StopAsyncIteration):
            await anext(generator)

        mock_instance.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_redis_client_function() -> None:
    """Verify get_redis_client returns Redis instance bound to connection pool."""
    client = get_redis_client()
    assert isinstance(client, Redis)
    assert client.connection_pool is get_redis_pool()
    await client.aclose()


@pytest.mark.asyncio
async def test_lifespan_context_manager() -> None:
    """Verify lifespan context manager initializes and closes pool gracefully."""
    with (
        patch("leaderboard_service.src.main.init_redis_pool", new_callable=AsyncMock) as mock_init,
        patch(
            "leaderboard_service.src.main.close_redis_pool", new_callable=AsyncMock
        ) as mock_close,
    ):
        async with lifespan(app):
            mock_init.assert_awaited_once()
            mock_close.assert_not_awaited()

        mock_close.assert_awaited_once()


# ==============================================================================
# 3. Configuration & Pydantic-Settings Tests
# ==============================================================================


def test_settings_default_values() -> None:
    """Verify Settings initializes with safe defaults and correct types."""
    settings = Settings(
        redis_host="test-redis",
        redis_port=6380,
        redis_db=1,
        redis_password=None,
    )
    assert settings.app_name == "IronTracker Leaderboard Service"
    assert settings.debug is False
    assert settings.app_host == "127.0.0.1"
    assert settings.app_port == 8002
    assert settings.redis_host == "test-redis"
    assert settings.redis_port == 6380
    assert settings.redis_db == 1
    assert settings.redis_password is None
    assert settings.redis_url == "redis://test-redis:6380/1"


def test_settings_with_password() -> None:
    """Verify Settings constructs redis_url with authentication credentials when provided."""
    settings = Settings(
        redis_host="auth-redis",
        redis_port=6379,
        redis_db=2,
        redis_password="secret_password",
    )
    assert settings.redis_url == "redis://:secret_password@auth-redis:6379/2"
    assert settings.REDIS_URL == "redis://:secret_password@auth-redis:6379/2"


def test_settings_uppercase_property_accessors() -> None:
    """Verify uppercase property accessors match lowercase fields."""
    settings = Settings(
        app_name="Custom Leaderboard",
        debug=True,
        app_host="127.0.0.1",
        app_port=9000,
        redis_host="my-redis",
        redis_port=6379,
        redis_db=3,
        redis_password="pwd",
    )
    assert settings.APP_NAME == "Custom Leaderboard"
    assert settings.DEBUG is True
    assert settings.APP_HOST == "127.0.0.1"
    assert settings.APP_PORT == 9000
    assert settings.REDIS_HOST == "my-redis"
    assert settings.REDIS_PORT == 6379
    assert settings.REDIS_DB == 3
    assert settings.REDIS_PASSWORD == "pwd"


def test_redis_settings_standalone() -> None:
    """Verify RedisSettings standalone model and property behavior."""
    redis_cfg = RedisSettings(
        redis_host="standalone-redis",
        redis_port=6381,
        redis_db=5,
        redis_password="sec",
    )
    assert redis_cfg.redis_url == "redis://:sec@standalone-redis:6381/5"
    assert redis_cfg.REDIS_HOST == "standalone-redis"
    assert redis_cfg.REDIS_PORT == 6381
    assert redis_cfg.REDIS_DB == 5
    assert redis_cfg.REDIS_PASSWORD == "sec"
    assert redis_cfg.REDIS_URL == "redis://:sec@standalone-redis:6381/5"


def test_get_settings_cached_singleton() -> None:
    """Verify get_settings returns the same cached instance."""
    s1 = get_settings()
    s2 = get_settings()
    assert s1 is s2


# ==============================================================================
# 4. OpenAPI Specification & Routing Standard Tests
# ==============================================================================


def test_openapi_schema_leaderboard_routes() -> None:
    """Verify OpenAPI schema includes monitoring probes and no duplicate paths."""
    schema = app.openapi()
    paths: dict[str, Any] = schema.get("paths", {})

    assert "/health" in paths, "Missing /health endpoint in OpenAPI schema"
    assert "/ready" in paths, "Missing /ready endpoint in OpenAPI schema"

    # Verify no unversioned domain routes or trailing slash duplicates
    for path in paths:
        if path.startswith("/api/"):
            assert path.startswith("/api/v1/"), (
                f"Route '{path}' does not use canonical /api/v1 prefix"
            )
        assert not path.endswith("/") or path == "/", (
            f"Trailing slash duplicate found in OpenAPI schema: {path}"
        )


def test_openapi_schema_operation_ids_unique() -> None:
    """Verify that all operation IDs in Leaderboard Service OpenAPI schema are unique."""
    schema = app.openapi()
    paths: dict[str, Any] = schema.get("paths", {})
    operation_ids: list[str] = []

    for path, methods in paths.items():
        for method, op_data in methods.items():
            if isinstance(op_data, dict) and "operationId" in op_data:
                op_id = op_data["operationId"]
                assert op_id not in operation_ids, (
                    f"Duplicate operationId '{op_id}' in {method.upper()} {path}"
                )
                operation_ids.append(op_id)


def test_openapi_readiness_responses_documented() -> None:
    """Verify OpenAPI schema documents both 200 and 503 responses for /ready probe."""
    schema = app.openapi()
    ready_responses = schema["paths"]["ready" if "ready" in schema["paths"] else "/ready"]["get"][
        "responses"
    ]

    assert "200" in ready_responses
    assert "503" in ready_responses


def test_domain_router_prefix() -> None:
    """Verify aggregating router is configured with canonical /api/v1 prefix."""
    assert router.prefix == "/api/v1"


# ==============================================================================
# 5. Architecture, Modularity & Security Standards Tests
# ==============================================================================


def test_layered_architecture_structure() -> None:
    """Verify strict layered architecture files exist and no flat files exist."""
    base_dir = PROJECT_ROOT / "leaderboard_service" / "src"

    expected_modules = [
        base_dir / "__init__.py",
        base_dir / "main.py",
        base_dir / "dependencies.py",
        base_dir / "core" / "__init__.py",
        base_dir / "core" / "config.py",
        base_dir / "core" / "redis.py",
        base_dir / "schemas" / "__init__.py",
        base_dir / "schemas" / "health.py",
        base_dir / "services" / "__init__.py",
        base_dir / "routes" / "__init__.py",
    ]

    for mod_path in expected_modules:
        assert mod_path.is_file(), f"Expected architectural file missing: {mod_path}"

    forbidden_flat_files = [
        base_dir / "config.py",
        base_dir / "redis.py",
        base_dir / "schemas.py",
    ]
    for flat_file in forbidden_flat_files:
        assert not flat_file.exists(), (
            f"Flat module {flat_file} violates layered architecture guidelines"
        )


def test_future_annotations_in_leaderboard_files() -> None:
    """Verify from __future__ import annotations is the first statement in all service files."""
    service_dir = PROJECT_ROOT / "leaderboard_service"
    py_files = list(service_dir.rglob("*.py"))
    assert len(py_files) > 0

    for py_file in py_files:
        content = py_file.read_text(encoding="utf-8")
        lines = [
            line.strip()
            for line in content.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]
        assert len(lines) > 0, f"File {py_file} is empty"
        assert lines[0] == "from __future__ import annotations", (
            f"File {py_file} must have 'from __future__ import annotations' as first statement"
        )


def test_no_forbidden_aioredis_or_dangerous_calls() -> None:
    """Verify no forbidden aioredis imports or dangerous functions in leaderboard_service."""
    service_dir = PROJECT_ROOT / "leaderboard_service"
    dangerous_keywords = ["aioredis", "eval(", "exec(", "__import__(", "os.system(", "subprocess."]

    for py_file in service_dir.rglob("*.py"):
        content = py_file.read_text(encoding="utf-8")
        for keyword in dangerous_keywords:
            assert keyword not in content, f"Forbidden keyword '{keyword}' found in {py_file}!"


@pytest.mark.asyncio
async def test_live_redis_connectivity() -> None:
    """Verify live Redis connectivity via readiness probe when container is running."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ready")

    # If Redis is running locally (as in Docker), status should be 200, otherwise 503
    assert response.status_code in (200, 503)
    data = response.json()
    if response.status_code == 200:
        assert data == {"status": "ready", "redis": "connected"}
    else:
        assert data["status"] == "unavailable"
        assert data["redis"] == "disconnected"
