from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from workout_service.src import app


def test_openapi_schema_workout_routes_canonical_prefix() -> None:
    """Verify that all workout domain routes in the OpenAPI schema start with /api/v1/workouts."""
    schema = app.openapi()
    paths: dict[str, Any] = schema.get("paths", {})

    # Filter all workout-related routes by path or tags
    workout_paths: list[str] = [path for path in paths if "workout" in path.lower()]

    assert len(workout_paths) > 0, "No workout routes found in OpenAPI schema"
    for path in workout_paths:
        assert path.startswith("/api/v1/workouts"), (
            f"Workout route '{path}' does not use canonical prefix '/api/v1/workouts'"
        )

    # Verify exact canonical paths present in schema
    assert set(workout_paths) == {
        "/api/v1/workouts",
        "/api/v1/workouts/{workout_id}",
    }


def test_openapi_schema_no_deprecated_routes() -> None:
    """Verify that deprecated unversioned or legacy routes are absent from OpenAPI schema."""
    schema = app.openapi()
    paths: dict[str, Any] = schema.get("paths", {})

    forbidden_exact_paths = [
        "/workouts",
        "/workouts/",
        "/workouts/{workout_id}",
        "/workouts/{workout_id}/",
        "/api/workouts",
        "/api/workouts/",
        "/api/workouts/{workout_id}",
        "/api/workouts/{workout_id}/",
    ]

    for forbidden in forbidden_exact_paths:
        assert forbidden not in paths, (
            f"Deprecated route '{forbidden}' must not be present in OpenAPI schema"
        )

    # Ensure no path starts with /workouts or /api/workouts (without /v1)
    for path in paths:
        assert not path.startswith("/workouts"), (
            f"Route '{path}' starts with deprecated prefix '/workouts'"
        )
        if path.startswith("/api/"):
            assert path.startswith("/api/v1/"), f"Route '{path}' uses legacy non-v1 API prefix"


def test_openapi_schema_no_duplicate_operations_or_paths() -> None:
    """Verify that OpenAPI schema contains no duplicate paths or operations."""
    schema = app.openapi()
    paths: dict[str, Any] = schema.get("paths", {})

    # Trailing slash variants must be excluded via include_in_schema=False
    assert "/api/v1/workouts/" not in paths, (
        "Duplicate trailing slash path '/api/v1/workouts/' found in OpenAPI schema"
    )
    assert "/api/v1/workouts/{workout_id}/" not in paths, (
        "Duplicate trailing slash path '/api/v1/workouts/{workout_id}/' found in OpenAPI schema"
    )

    # Check that operation IDs are unique across the entire schema
    operation_ids: list[str] = []
    for path, methods in paths.items():
        for method, op_data in methods.items():
            if isinstance(op_data, dict) and "operationId" in op_data:
                op_id = op_data["operationId"]
                assert op_id not in operation_ids, (
                    f"Duplicate operationId '{op_id}' found for {method.upper()} {path}"
                )
                operation_ids.append(op_id)

    # Check exact methods per canonical path
    assert set(paths["/api/v1/workouts"].keys()) == {"get", "post"}
    assert set(paths["/api/v1/workouts/{workout_id}"].keys()) == {"get", "put", "patch", "delete"}


@pytest.mark.asyncio
async def test_deprecated_routes_return_404_via_http() -> None:
    """Verify that calling deprecated route prefixes via HTTP returns 404 Not Found."""
    transport = ASGITransport(app=app)
    random_id = uuid.uuid4()

    deprecated_endpoints = [
        ("GET", "/workouts"),
        ("GET", "/workouts/"),
        ("POST", "/workouts"),
        ("POST", "/workouts/"),
        ("GET", f"/workouts/{random_id}"),
        ("GET", "/api/workouts"),
        ("GET", "/api/workouts/"),
        ("POST", "/api/workouts"),
        ("POST", "/api/workouts/"),
        ("GET", f"/api/workouts/{random_id}"),
        ("PUT", f"/api/workouts/{random_id}"),
        ("DELETE", f"/api/workouts/{random_id}"),
    ]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for method, endpoint in deprecated_endpoints:
            res = await client.request(method, endpoint)
            assert res.status_code == 404, (
                f"Expected 404 for deprecated route {method} {endpoint}, got {res.status_code}"
            )


@pytest.mark.asyncio
async def test_canonical_routes_slash_and_non_slash_both_route_correctly() -> None:
    """Verify that canonical routes handle requests and trailing slashes redirect to canonical."""
    transport = ASGITransport(app=app)
    # 1. Without redirect following: canonical returns 422, trailing slash returns 307
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_canonical = await client.post("/api/v1/workouts", json={})
        assert res_canonical.status_code == 422

        res_slash = await client.post("/api/v1/workouts/", json={})
        assert res_slash.status_code == 307
        assert res_slash.headers["location"].endswith("/api/v1/workouts")

        non_existent_id = uuid.uuid4()
        res_get_canonical = await client.get(f"/api/v1/workouts/{non_existent_id}")
        assert res_get_canonical.status_code == 404
        assert res_get_canonical.json().get("detail") == "Workout not found"

        res_get_slash = await client.get(f"/api/v1/workouts/{non_existent_id}/")
        assert res_get_slash.status_code == 307
        assert res_get_slash.headers["location"].endswith(f"/api/v1/workouts/{non_existent_id}")

    # 2. With follow_redirects=True: trailing slash seamlessly redirects to canonical
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        follow_redirects=True,
    ) as client:
        res_redirect_post = await client.post("/api/v1/workouts/", json={})
        assert res_redirect_post.status_code == 422

        res_redirect_get = await client.get(f"/api/v1/workouts/{non_existent_id}/")
        assert res_redirect_get.status_code == 404
        assert res_redirect_get.json().get("detail") == "Workout not found"
