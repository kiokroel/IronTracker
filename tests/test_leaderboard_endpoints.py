from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from redis.exceptions import ConnectionError as RedisConnectionError, RedisError

from leaderboard_service.src import (
    LeaderboardResponse,
    LeaderboardService,
    UserRankResponse,
    app,
    get_redis,
)

# ==============================================================================
# 1. Leaderboard Service Direct Unit Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_leaderboard_service_empty_leaderboard() -> None:
    """Verify LeaderboardService returns empty list when Redis key has no entries."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(return_value=0)

    service = LeaderboardService(redis=mock_redis)
    result = await service.get_tonnage_leaderboard(limit=10, offset=0)

    assert result.metric == "tonnage"
    assert result.total_entries == 0
    assert result.entries == []
    mock_redis.zcard.assert_awaited_once()
    mock_redis.zrange.assert_not_called()


@pytest.mark.asyncio
async def test_leaderboard_service_populated_leaderboard() -> None:
    """Verify LeaderboardService parses tuples from Redis ZRANGE correctly with 1-based ranks."""
    user1 = uuid4()
    user2 = uuid4()
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(return_value=2)
    mock_redis.zrange = AsyncMock(
        return_value=[
            (str(user1), 25000.5),
            (str(user2).encode("utf-8"), 12000.0),
        ]
    )

    service = LeaderboardService(redis=mock_redis)
    result = await service.get_tonnage_leaderboard(limit=10, offset=0)

    assert result.total_entries == 2
    assert len(result.entries) == 2

    assert result.entries[0].rank == 1
    assert result.entries[0].user_id == user1
    assert result.entries[0].score == 25000.5

    assert result.entries[1].rank == 2
    assert result.entries[1].user_id == user2
    assert result.entries[1].score == 12000.0


@pytest.mark.asyncio
async def test_leaderboard_service_pagination_offset() -> None:
    """Verify LeaderboardService sets correct ranks when offset > 0."""
    user3 = uuid4()
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(return_value=10)
    mock_redis.zrange = AsyncMock(return_value=[(str(user3), 5000.0)])

    service = LeaderboardService(redis=mock_redis)
    result = await service.get_tonnage_leaderboard(limit=5, offset=2)

    assert result.total_entries == 10
    assert len(result.entries) == 1
    assert result.entries[0].rank == 3  # offset=2 -> rank=3
    assert result.entries[0].user_id == user3
    mock_redis.zrange.assert_awaited_once_with(
        name="leaderboard:tonnage",
        start=2,
        end=6,
        desc=True,
        withscores=True,
    )


@pytest.mark.asyncio
async def test_leaderboard_service_offset_exceeds_total() -> None:
    """Verify LeaderboardService returns empty entries if offset >= total_entries."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(return_value=5)

    service = LeaderboardService(redis=mock_redis)
    result = await service.get_tonnage_leaderboard(limit=10, offset=5)

    assert result.total_entries == 5
    assert result.entries == []
    mock_redis.zrange.assert_not_called()


@pytest.mark.asyncio
async def test_leaderboard_service_invalid_member_ignored() -> None:
    """Verify LeaderboardService ignores malformed UUIDs stored in Redis without crashing."""
    valid_user = uuid4()
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(return_value=2)
    mock_redis.zrange = AsyncMock(
        return_value=[
            ("invalid-uuid-string", 9999.0),
            (str(valid_user), 1500.0),
        ]
    )

    service = LeaderboardService(redis=mock_redis)
    result = await service.get_tonnage_leaderboard(limit=10, offset=0)

    assert result.total_entries == 2
    assert len(result.entries) == 1
    assert result.entries[0].user_id == valid_user


@pytest.mark.asyncio
async def test_leaderboard_service_user_rank_existing() -> None:
    """Verify LeaderboardService returns correct 1-based rank and score for existing user."""
    target_user = uuid4()
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zrevrank = AsyncMock(return_value=0)  # 0th index in Redis -> rank 1
    mock_redis.zscore = AsyncMock(return_value=14500.0)

    service = LeaderboardService(redis=mock_redis)
    user_rank = await service.get_user_tonnage_rank(user_id=target_user)

    assert user_rank.user_id == target_user
    assert user_rank.rank == 1
    assert user_rank.score == 14500.0


@pytest.mark.asyncio
async def test_leaderboard_service_user_rank_not_found() -> None:
    """Verify LeaderboardService returns rank=None and score=0.0 when user has no scores."""
    unknown_user = uuid4()
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zrevrank = AsyncMock(return_value=None)
    mock_redis.zscore = AsyncMock(return_value=None)

    service = LeaderboardService(redis=mock_redis)
    user_rank = await service.get_user_tonnage_rank(user_id=unknown_user)

    assert user_rank.user_id == unknown_user
    assert user_rank.rank is None
    assert user_rank.score == 0.0


# ==============================================================================
# 2. HTTP API Endpoint Tests: GET /api/v1/leaderboard/tonnage
# ==============================================================================


@pytest.mark.asyncio
async def test_get_tonnage_leaderboard_api_success() -> None:
    """Verify GET /api/v1/leaderboard/tonnage returns HTTP 200 and LeaderboardResponse."""
    user1 = uuid4()
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(return_value=1)
    mock_redis.zrange = AsyncMock(return_value=[(str(user1), 10500.0)])

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/leaderboard/tonnage?limit=10&offset=0")

        assert res.status_code == 200
        data = res.json()
        validated = LeaderboardResponse(**data)
        assert validated.metric == "tonnage"
        assert validated.total_entries == 1
        assert len(validated.entries) == 1
        assert validated.entries[0].user_id == user1
        assert validated.entries[0].rank == 1
        assert validated.entries[0].score == 10500.0
    finally:
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_get_tonnage_leaderboard_api_pagination() -> None:
    """Verify query parameters limit and offset pass correctly to service and Redis."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(return_value=50)
    mock_redis.zrange = AsyncMock(return_value=[])

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/leaderboard/tonnage?limit=25&offset=10")

        assert res.status_code == 200
        mock_redis.zrange.assert_awaited_once_with(
            name="leaderboard:tonnage",
            start=10,
            end=34,
            desc=True,
            withscores=True,
        )
    finally:
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_get_tonnage_leaderboard_api_validation_errors() -> None:
    """Verify invalid query parameters (limit <= 0, limit > 100, offset < 0) return 422."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_limit_zero = await client.get("/api/v1/leaderboard/tonnage?limit=0")
        assert res_limit_zero.status_code == 422

        res_limit_too_high = await client.get("/api/v1/leaderboard/tonnage?limit=101")
        assert res_limit_too_high.status_code == 422

        res_offset_negative = await client.get("/api/v1/leaderboard/tonnage?offset=-1")
        assert res_offset_negative.status_code == 422

        res_invalid_type = await client.get("/api/v1/leaderboard/tonnage?limit=abc")
        assert res_invalid_type.status_code == 422


@pytest.mark.asyncio
async def test_get_tonnage_leaderboard_api_redis_failure() -> None:
    """Verify Redis connection errors in GET /tonnage produce HTTP 503 Service Unavailable."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(side_effect=RedisConnectionError("Redis cluster unreachable"))

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/leaderboard/tonnage")

        assert res.status_code == 503
        data = res.json()
        assert data.get("detail") == "Redis service unavailable"
    finally:
        app.dependency_overrides.pop(get_redis, None)


# ==============================================================================
# 3. HTTP API Endpoint Tests: GET /api/v1/leaderboard/tonnage/users/{user_id}
# ==============================================================================


@pytest.mark.asyncio
async def test_get_user_tonnage_rank_api_existing_user() -> None:
    """Verify GET /api/v1/leaderboard/tonnage/users/{user_id} returns HTTP 200 for existing user."""
    target_user = uuid4()
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zrevrank = AsyncMock(return_value=4)  # 5th place
    mock_redis.zscore = AsyncMock(return_value=8450.0)

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(f"/api/v1/leaderboard/tonnage/users/{target_user}")

        assert res.status_code == 200
        data = res.json()
        validated = UserRankResponse(**data)
        assert validated.user_id == target_user
        assert validated.rank == 5
        assert validated.score == 8450.0
    finally:
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_get_user_tonnage_rank_api_unranked_user() -> None:
    """Verify GET user rank returns HTTP 200 with rank=None, score=0.0 for user with no data."""
    unknown_user = uuid4()
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zrevrank = AsyncMock(return_value=None)
    mock_redis.zscore = AsyncMock(return_value=None)

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(f"/api/v1/leaderboard/tonnage/users/{unknown_user}")

        assert res.status_code == 200
        data = res.json()
        validated = UserRankResponse(**data)
        assert validated.user_id == unknown_user
        assert validated.rank is None
        assert validated.score == 0.0
    finally:
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_get_user_tonnage_rank_api_invalid_uuid() -> None:
    """Verify invalid UUID in path parameter returns HTTP 422 Unprocessable Entity."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/leaderboard/tonnage/users/not-a-valid-uuid")

    assert res.status_code == 422


@pytest.mark.asyncio
async def test_get_user_tonnage_rank_api_redis_failure() -> None:
    """Verify Redis error in GET user rank endpoint returns HTTP 503."""
    target_user = uuid4()
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zrevrank = AsyncMock(side_effect=RedisError("Redis timeout"))

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(f"/api/v1/leaderboard/tonnage/users/{target_user}")

        assert res.status_code == 503
        data = res.json()
        assert data.get("detail") == "Redis service unavailable"
    finally:
        app.dependency_overrides.pop(get_redis, None)


# ==============================================================================
# 4. OpenAPI Specification and Canonical Routing Validation
# ==============================================================================


def test_leaderboard_openapi_specification() -> None:
    """Verify OpenAPI schema contains canonical paths, correct methods, and operationIds."""
    schema = app.openapi()
    paths = schema.get("paths", {})

    expected_tonnage_path = "/api/v1/leaderboard/tonnage"
    expected_user_path = "/api/v1/leaderboard/tonnage/users/{user_id}"

    assert expected_tonnage_path in paths, f"{expected_tonnage_path} not found in OpenAPI schema"
    assert expected_user_path in paths, f"{expected_user_path} not found in OpenAPI schema"

    # Verify operations and operation IDs
    tonnage_op = paths[expected_tonnage_path].get("get")
    assert tonnage_op is not None
    assert tonnage_op.get("operationId") == "get_tonnage_leaderboard"
    assert "200" in tonnage_op.get("responses", {})
    assert "503" in tonnage_op.get("responses", {})

    user_op = paths[expected_user_path].get("get")
    assert user_op is not None
    assert user_op.get("operationId") == "get_user_tonnage_rank"
    assert "200" in user_op.get("responses", {})
    assert "503" in user_op.get("responses", {})


def test_no_deprecated_unversioned_leaderboard_routes() -> None:
    """Verify that no unversioned or deprecated routes exist in OpenAPI schema."""
    schema = app.openapi()
    paths = schema.get("paths", {})

    forbidden_routes = [
        "/leaderboard",
        "/leaderboard/tonnage",
        "/leaderboard/tonnage/users/{user_id}",
        "/api/leaderboard/tonnage",
    ]

    for forbidden in forbidden_routes:
        assert forbidden not in paths, f"Forbidden legacy route found in OpenAPI: {forbidden}"


@pytest.mark.asyncio
async def test_canonical_trailing_slash_handling() -> None:
    """Verify trailing slash requests receive 307 redirect or route seamlessly."""
    transport = ASGITransport(app=app)
    # Without following redirects: returns 307 Temporary Redirect to canonical path
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/leaderboard/tonnage/")
        assert res.status_code == 307
        assert res.headers["location"].endswith("/api/v1/leaderboard/tonnage")

    # With follow_redirects: seamlessly succeeds
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zcard = AsyncMock(return_value=0)

    async def override_get_redis() -> Any:
        yield mock_redis

    app.dependency_overrides[get_redis] = override_get_redis
    try:
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            follow_redirects=True,
        ) as client:
            res_redirected = await client.get("/api/v1/leaderboard/tonnage/")
            assert res_redirected.status_code == 200
            assert res_redirected.json().get("total_entries") == 0
    finally:
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_unsupported_http_methods() -> None:
    """Verify POST, PUT, DELETE to GET endpoints return HTTP 405 Method Not Allowed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        post_res = await client.post("/api/v1/leaderboard/tonnage", json={})
        put_res = await client.put("/api/v1/leaderboard/tonnage", json={})
        delete_res = await client.delete("/api/v1/leaderboard/tonnage")

    assert post_res.status_code == 405
    assert put_res.status_code == 405
    assert delete_res.status_code == 405
