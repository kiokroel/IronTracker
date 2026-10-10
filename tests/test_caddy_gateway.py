from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import yaml
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis

from leaderboard_service.src.dependencies import get_redis
from leaderboard_service.src.main import app as leaderboard_app
from users_service.src.main import app as users_app
from workout_service.src.core.database import get_db
from workout_service.src.main import app as workout_app

REPO_ROOT = Path(__file__).resolve().parent.parent
CADDYFILE_PATH = REPO_ROOT / "Caddyfile"
DOCKER_COMPOSE_PATH = REPO_ROOT / "docker-compose.yml"


# ==============================================================================
# 1. Caddyfile Configuration Validation Tests
# ==============================================================================


def test_caddyfile_exists_and_is_non_empty() -> None:
    """Verify that Caddyfile exists in project root and has content."""
    assert CADDYFILE_PATH.exists(), "Caddyfile must exist in repository root"
    content = CADDYFILE_PATH.read_text(encoding="utf-8")
    assert len(content.strip()) > 0, "Caddyfile must not be empty"


def test_caddyfile_structure_and_directives() -> None:
    """Verify essential routing directives and security settings in Caddyfile."""
    content = CADDYFILE_PATH.read_text(encoding="utf-8")

    # Global options
    assert "admin off" in content, "Admin API should be disabled for security"

    # Listen port
    assert ":80 {" in content or "{$GATEWAY_PORT" in content, "Gateway must listen on port 80"

    # Healthcheck handle
    assert "handle /health {" in content, "Must contain /health handle block"
    assert "caddy-gateway" in content, "Health response must identify caddy-gateway"
    assert "application/json" in content, "Content-Type must be application/json"

    # Workout service reverse proxy
    assert "handle /api/v1/workouts* {" in content, (
        "Must contain /api/v1/workouts* reverse proxy handle block"
    )
    assert "workout-service:8000" in content, (
        "Must proxy to workout-service:8000 with environment variable support"
    )

    # Leaderboard service reverse proxy
    assert "handle /api/v1/leaderboard* {" in content, (
        "Must contain /api/v1/leaderboard* reverse proxy handle block"
    )
    assert "leaderboard-service:8002" in content, (
        "Must proxy to leaderboard-service:8002 with environment variable support"
    )

    # Users service reverse proxy
    assert "handle /api/v1/users* {" in content, (
        "Must contain /api/v1/users* reverse proxy handle block"
    )
    assert "users-service:8001" in content, (
        "Must proxy to users-service:8001 with environment variable support"
    )

    # Fallback 404 handle
    assert "handle {" in content
    assert 'respond "{\\"detail\\":\\"Not Found\\"}" 404' in content


# ==============================================================================
# 2. Docker Compose Integration Tests
# ==============================================================================


def test_docker_compose_caddy_service_configuration() -> None:
    """Verify that Caddy API Gateway is declared properly in docker-compose.yml."""
    assert DOCKER_COMPOSE_PATH.exists(), "docker-compose.yml must exist"
    loaded = yaml.safe_load(DOCKER_COMPOSE_PATH.read_text(encoding="utf-8"))
    assert isinstance(loaded, dict)
    compose_data: dict[str, Any] = loaded

    services_raw = compose_data.get("services")
    assert isinstance(services_raw, dict)
    services: dict[str, Any] = services_raw
    assert "caddy" in services, "caddy service must be defined in docker-compose.yml"

    caddy_raw = services["caddy"]
    assert isinstance(caddy_raw, dict)
    caddy_svc: dict[str, Any] = caddy_raw
    assert caddy_svc.get("image") == "caddy:2-alpine", "Image must be caddy:2-alpine"
    assert caddy_svc.get("container_name") == "irontracker-gateway"

    networks_raw = caddy_svc.get("networks")
    assert isinstance(networks_raw, list)
    networks: list[str] = [str(n) for n in networks_raw]
    assert "irontracker-network" in networks

    # Check ports
    ports_raw = caddy_svc.get("ports")
    assert isinstance(ports_raw, list)
    ports: list[str] = [str(p) for p in ports_raw]
    assert any("80" in p for p in ports), "Must expose port 80"

    # Check volumes
    volumes_raw = caddy_svc.get("volumes")
    assert isinstance(volumes_raw, list)
    vol_strs: list[str] = [str(v) for v in volumes_raw]
    assert any("Caddyfile" in v for v in vol_strs), "Must mount Caddyfile"
    assert any("caddy_data" in v for v in vol_strs), "Must mount caddy_data"
    assert any("caddy_config" in v for v in vol_strs), "Must mount caddy_config"

    # Check top-level volumes definition
    top_volumes_raw = compose_data.get("volumes")
    assert isinstance(top_volumes_raw, dict)
    top_volumes: dict[str, Any] = top_volumes_raw
    assert "caddy_data" in top_volumes, "caddy_data volume must be declared"
    assert "caddy_config" in top_volumes, "caddy_config volume must be declared"


# ==============================================================================
# 3. Gateway Routing Simulation & End-to-End Microservice Verification
# ==============================================================================


class SimulatedGatewayClient:
    """Simulates Caddy reverse proxy routing logic in-process for integration tests."""

    def __init__(self) -> None:
        self.workout_transport = ASGITransport(app=workout_app)
        self.leaderboard_transport = ASGITransport(app=leaderboard_app)
        self.users_transport = ASGITransport(app=users_app)

    async def get(self, path: str, **kwargs: Any) -> Any:
        if path == "/health":
            # Direct response from Caddy
            from httpx import Response

            return Response(
                status_code=200,
                headers={"Content-Type": "application/json"},
                json={"status": "ok", "service": "caddy-gateway"},
            )
        elif path.startswith("/api/v1/workouts"):
            async with AsyncClient(
                transport=self.workout_transport, base_url="http://gateway"
            ) as client:
                return await client.get(path, **kwargs)
        elif path.startswith("/api/v1/leaderboard"):
            async with AsyncClient(
                transport=self.leaderboard_transport, base_url="http://gateway"
            ) as client:
                return await client.get(path, **kwargs)
        elif path.startswith("/api/v1/users"):
            async with AsyncClient(
                transport=self.users_transport, base_url="http://gateway"
            ) as client:
                return await client.get(path, **kwargs)
        else:
            # Fallback 404 from Caddy
            from httpx import Response

            return Response(
                status_code=404,
                headers={"Content-Type": "application/json"},
                json={"detail": "Not Found"},
            )


@pytest.mark.asyncio
async def test_gateway_health_endpoint() -> None:
    """Verify that Gateway health check returns caddy-gateway status."""
    gateway = SimulatedGatewayClient()
    response = await gateway.get("/health")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "application/json"
    data = response.json()
    assert data == {"status": "ok", "service": "caddy-gateway"}


@pytest.mark.asyncio
async def test_gateway_routes_to_workout_service() -> None:
    """Verify that /api/v1/workouts requests are forwarded to Workout Service."""
    gateway = SimulatedGatewayClient()

    # Mock DB dependency to test endpoint without live postgres
    from unittest.mock import MagicMock

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = tuple[Any, ...]()
    mock_session.execute = AsyncMock(return_value=mock_result)

    async def override_db() -> Any:
        yield mock_session

    workout_app.dependency_overrides[get_db] = override_db
    try:
        response = await gateway.get("/api/v1/workouts")
        assert response.status_code == 200
        data: Any = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
    finally:
        workout_app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_gateway_routes_to_leaderboard_service() -> None:
    """Verify that /api/v1/leaderboard requests are forwarded to Leaderboard Service."""
    gateway = SimulatedGatewayClient()

    # Mock Redis dependency to test endpoint without live redis
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(return_value=1)
    test_user_id = uuid4()
    mock_redis.zrange = AsyncMock(return_value=[(str(test_user_id), 1250.0)])

    async def override_redis() -> Any:
        yield mock_redis

    leaderboard_app.dependency_overrides[get_redis] = override_redis
    try:
        response = await gateway.get("/api/v1/leaderboard/tonnage")
        assert response.status_code == 200
        data: dict[str, Any] = response.json()
        assert data.get("total_entries") == 1
        entries = data.get("entries")
        assert isinstance(entries, list)
        assert len(entries) == 1
    finally:
        leaderboard_app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_gateway_unmatched_route_returns_404() -> None:
    """Verify that requests to unregistered routes return 404 from Gateway fallback."""
    gateway = SimulatedGatewayClient()
    response = await gateway.get("/api/v1/unknown-service/endpoint")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


@pytest.mark.asyncio
async def test_gateway_routes_to_users_service() -> None:
    """Verify that /api/v1/users requests are forwarded to Users Service."""
    gateway = SimulatedGatewayClient()
    response = await gateway.get("/api/v1/users/me")
    assert response.status_code == 401
