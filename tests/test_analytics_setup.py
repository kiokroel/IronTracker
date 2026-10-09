from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo.errors import CollectionInvalid, ConnectionFailure, ServerSelectionTimeoutError

from analytics_service.src import (
    HealthResponse,
    MongoSettings,
    ReadyErrorResponse,
    ReadyResponse,
    Settings,
    app,
    close_mongo_client,
    consume_events,
    ensure_timeseries_collection,
    get_mongo_database,
    get_mongo_db,
    get_service_status,
    get_settings,
    init_mongo_client,
    run_worker,
)
from analytics_service.src.main import lifespan

# ==============================================================================
# 1. Health & Readiness Probe Endpoints Tests
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
    assert validated.service == "analytics"


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
    """Verify /ready returns HTTP 200 when MongoDB ping succeeds."""
    mock_db = MagicMock(spec=AsyncIOMotorDatabase)
    mock_db.command = AsyncMock(return_value={"ok": 1})

    def override_get_mongo_db() -> Any:
        return mock_db

    app.dependency_overrides[get_mongo_db] = override_get_mongo_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")

        assert response.status_code == 200
        data = response.json()
        validated = ReadyResponse(**data)
        assert validated.status == "ready"
        assert validated.database == "connected"
        assert validated.mongodb == "connected"
    finally:
        app.dependency_overrides.pop(get_mongo_db, None)


@pytest.mark.asyncio
async def test_ready_endpoint_ping_failed_response() -> None:
    """Verify /ready returns HTTP 503 when MongoDB ping returns ok != 1."""
    mock_db = MagicMock(spec=AsyncIOMotorDatabase)
    mock_db.command = AsyncMock(return_value={"ok": 0})

    def override_get_mongo_db() -> Any:
        return mock_db

    app.dependency_overrides[get_mongo_db] = override_get_mongo_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")

        assert response.status_code == 503
        data = response.json()
        validated = ReadyErrorResponse(**data)
        assert validated.status == "unavailable"
        assert validated.database == "disconnected"
        assert "unexpected response" in validated.detail
    finally:
        app.dependency_overrides.pop(get_mongo_db, None)


@pytest.mark.asyncio
async def test_ready_endpoint_connection_failure() -> None:
    """Verify /ready returns HTTP 503 when MongoDB connection fails or times out."""
    mock_db = MagicMock(spec=AsyncIOMotorDatabase)
    mock_db.command = AsyncMock(
        side_effect=ServerSelectionTimeoutError("No MongoDB servers found within timeout")
    )

    def override_get_mongo_db() -> Any:
        return mock_db

    app.dependency_overrides[get_mongo_db] = override_get_mongo_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")

        assert response.status_code == 503
        data = response.json()
        validated = ReadyErrorResponse(**data)
        assert validated.status == "unavailable"
        assert validated.database == "disconnected"
        assert "No MongoDB servers found" in validated.detail
    finally:
        app.dependency_overrides.pop(get_mongo_db, None)


# ==============================================================================
# 2. MongoDB Driver & Time Series Setup Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_init_and_close_mongo_client() -> None:
    """Verify init_mongo_client and close_mongo_client lifecycle functions."""
    with patch("analytics_service.src.core.database.AsyncIOMotorClient") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.admin.command = AsyncMock(return_value={"ok": 1})
        mock_client_cls.return_value = mock_instance

        client = await init_mongo_client("mongodb://localhost:27017")
        assert client is mock_instance
        mock_instance.admin.command.assert_awaited_once_with("ping")

        await close_mongo_client()
        mock_instance.close.assert_called_once()


@pytest.mark.asyncio
async def test_init_mongo_client_ping_failure_resilient() -> None:
    """Verify init_mongo_client catches ping failure and does not crash service startup."""
    with patch("analytics_service.src.core.database.AsyncIOMotorClient") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.admin.command = AsyncMock(
            side_effect=ConnectionFailure("Connection refused by MongoDB")
        )
        mock_client_cls.return_value = mock_instance

        client = await init_mongo_client()
        assert client is mock_instance
        await close_mongo_client()


@pytest.mark.asyncio
async def test_get_mongo_database_instance() -> None:
    """Verify get_mongo_database returns target database from client."""
    with patch("analytics_service.src.core.database.get_mongo_client") as mock_get_client:
        mock_client = MagicMock()
        mock_db = MagicMock(spec=AsyncIOMotorDatabase)
        mock_client.__getitem__.return_value = mock_db
        mock_get_client.return_value = mock_client

        db = get_mongo_database("custom_analytics_db")
        assert db is mock_db
        mock_client.__getitem__.assert_called_once_with("custom_analytics_db")


@pytest.mark.asyncio
async def test_ensure_timeseries_collection_creates_new() -> None:
    """Verify ensure_timeseries_collection creates collection with timeseries specs when absent."""
    mock_db = MagicMock(spec=AsyncIOMotorDatabase)
    mock_db.list_collection_names = AsyncMock(return_value=["other_collection"])
    mock_db.create_collection = AsyncMock()

    mock_col = MagicMock(spec=AsyncIOMotorCollection)
    mock_col.create_index = AsyncMock()
    mock_db.__getitem__.return_value = mock_col

    col = await ensure_timeseries_collection(db=mock_db, collection_name="workout_metrics")
    assert col is mock_col

    mock_db.create_collection.assert_awaited_once_with(
        "workout_metrics",
        timeseries={
            "timeField": "timestamp",
            "metaField": "metadata",
            "granularity": "seconds",
        },
    )
    mock_col.create_index.assert_awaited_once()


@pytest.mark.asyncio
async def test_ensure_timeseries_collection_already_exists() -> None:
    """Verify ensure_timeseries_collection does not re-create if collection already exists."""
    mock_db = MagicMock(spec=AsyncIOMotorDatabase)
    mock_db.list_collection_names = AsyncMock(return_value=["workout_metrics"])
    mock_db.create_collection = AsyncMock()

    mock_col = MagicMock(spec=AsyncIOMotorCollection)
    mock_col.create_index = AsyncMock()
    mock_db.__getitem__.return_value = mock_col

    col = await ensure_timeseries_collection(db=mock_db, collection_name="workout_metrics")
    assert col is mock_col

    mock_db.create_collection.assert_not_awaited()
    mock_col.create_index.assert_awaited_once()


@pytest.mark.asyncio
async def test_ensure_timeseries_collection_handles_concurrent_race() -> None:
    """Verify ensure_timeseries_collection catches CollectionInvalid error gracefully."""
    mock_db = MagicMock(spec=AsyncIOMotorDatabase)
    mock_db.list_collection_names = AsyncMock(return_value=[])
    mock_db.create_collection = AsyncMock(
        side_effect=CollectionInvalid("Collection already exists")
    )

    mock_col = MagicMock(spec=AsyncIOMotorCollection)
    mock_col.create_index = AsyncMock()
    mock_db.__getitem__.return_value = mock_col

    col = await ensure_timeseries_collection(db=mock_db, collection_name="workout_metrics")
    assert col is mock_col
    mock_col.create_index.assert_awaited_once()


@pytest.mark.asyncio
async def test_lifespan_startup_and_shutdown() -> None:
    """Verify lifespan context manager initializes client and closes it on shutdown."""
    with (
        patch("analytics_service.src.main.init_mongo_client", new_callable=AsyncMock) as mock_init,
        patch(
            "analytics_service.src.main.ensure_timeseries_collection", new_callable=AsyncMock
        ) as mock_ensure,
        patch(
            "analytics_service.src.main.close_mongo_client", new_callable=AsyncMock
        ) as mock_close,
    ):
        async with lifespan(app):
            mock_init.assert_awaited_once()
            mock_ensure.assert_awaited_once()
            mock_close.assert_not_awaited()

        mock_close.assert_awaited_once()


# ==============================================================================
# 3. Settings & Configuration Tests
# ==============================================================================


def test_mongo_settings_defaults() -> None:
    """Verify MongoSettings default values and connection URL generation."""
    settings = MongoSettings(
        host="127.0.0.1",
        port=27017,
        user=None,
        password=None,
        db="test_analytics",
    )
    assert settings.host == "127.0.0.1"
    assert settings.port == 27017
    assert settings.db == "test_analytics"
    assert settings.time_field == "timestamp"
    assert settings.meta_field == "metadata"
    assert settings.granularity == "seconds"
    assert settings.mongo_url == "mongodb://127.0.0.1:27017/test_analytics"


def test_mongo_settings_authenticated_url() -> None:
    """Verify MongoSettings URL with user credentials and authSource parameter."""
    settings = MongoSettings(
        host="mongo-host",
        port=27018,
        user="myuser",
        password="mypassword",
        db="irontracker_analytics",
        auth_source="admin",
    )
    expected = "mongodb://myuser:mypassword@mongo-host:27018/irontracker_analytics?authSource=admin"
    assert settings.mongo_url == expected


def test_settings_uppercase_accessors() -> None:
    """Verify uppercase property accessors on top-level Settings class."""
    settings = Settings(
        app_name="Custom Analytics",
        mongo_host="custom-mongo",
        mongo_port=27020,
        mongo_user="iron",
        mongo_password="pwd",
        mongo_db="analytics_prod",
    )
    assert settings.APP_NAME == "Custom Analytics"
    assert settings.MONGO_HOST == "custom-mongo"
    assert settings.MONGO_PORT == 27020
    assert settings.MONGO_USER == "iron"
    assert settings.MONGO_PASSWORD == "pwd"
    assert settings.MONGO_DB == "analytics_prod"
    assert "custom-mongo:27020" in settings.MONGO_URI


def test_get_settings_cached() -> None:
    """Verify get_settings returns cached singleton instance."""
    s1 = get_settings()
    s2 = get_settings()
    assert s1 is s2


# ==============================================================================
# 4. Worker Lifecycle Tests
# ==============================================================================


def test_worker_get_service_status() -> None:
    """Verify worker get_service_status matches required format."""
    status = get_service_status()
    assert status == {"status": "ok", "service": "analytics"}


@pytest.mark.asyncio
async def test_worker_consume_events_lifecycle() -> None:
    """Verify worker consume_events starts and cleanly stops via stop_event."""
    stop_event = asyncio.Event()

    task = asyncio.create_task(consume_events(stop_event=stop_event))
    await asyncio.sleep(0.01)
    stop_event.set()
    await task

    assert task.done()


@pytest.mark.asyncio
async def test_worker_run_worker_lifecycle() -> None:
    """Verify run_worker manages MongoDB initialization and cleanup."""
    stop_event = asyncio.Event()

    with (
        patch(
            "analytics_service.src.worker.init_mongo_client", new_callable=AsyncMock
        ) as mock_init,
        patch(
            "analytics_service.src.worker.ensure_timeseries_collection", new_callable=AsyncMock
        ) as mock_ensure,
        patch(
            "analytics_service.src.worker.close_mongo_client", new_callable=AsyncMock
        ) as mock_close,
    ):
        task = asyncio.create_task(run_worker(stop_event=stop_event))
        await asyncio.sleep(0.01)
        stop_event.set()
        await task

        mock_init.assert_awaited_once()
        mock_ensure.assert_awaited_once()
        mock_close.assert_awaited_once()


# ==============================================================================
# 5. OpenAPI Specification Tests
# ==============================================================================


def test_openapi_schema_contains_monitoring_probes() -> None:
    """Verify OpenAPI schema contains /health and /ready endpoints."""
    schema = app.openapi()
    paths = schema.get("paths", {})

    assert "/health" in paths
    assert "/ready" in paths

    ready_responses = paths["/ready"]["get"]["responses"]
    assert "200" in ready_responses
    assert "503" in ready_responses
