from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from workout_service.src import Base, Settings, app, get_db_session, get_settings
from workout_service.src.database import create_engine_and_session_factory

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def test_settings_default_values(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify default Settings values and proper async PostgreSQL DSN formation."""
    for key in (
        "POSTGRES_HOST",
        "POSTGRES_PORT",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_DB",
        "DB_ECHO",
        "DB_POOL_SIZE",
        "DB_MAX_OVERFLOW",
    ):
        monkeypatch.delenv(key, raising=False)

    settings = Settings()
    assert settings.postgres_host == "localhost"
    assert settings.postgres_port == 5432
    assert settings.postgres_user == "irontracker"
    assert settings.postgres_password == "irontracker_secret"
    assert settings.postgres_db == "irontracker_workout"
    assert settings.db_echo is False
    assert settings.db_pool_size == 10
    assert settings.db_max_overflow == 20

    expected_url = (
        "postgresql+asyncpg://irontracker:irontracker_secret@localhost:5432/irontracker_workout"
    )
    assert settings.database_url == expected_url


def test_settings_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify environment variables correctly override default settings."""
    monkeypatch.setenv("POSTGRES_HOST", "custom_host")
    monkeypatch.setenv("POSTGRES_PORT", "5433")
    monkeypatch.setenv("POSTGRES_USER", "custom_user")
    monkeypatch.setenv("POSTGRES_PASSWORD", "custom_pass")
    monkeypatch.setenv("POSTGRES_DB", "custom_db")
    monkeypatch.setenv("DB_ECHO", "true")

    custom_settings = Settings()
    assert custom_settings.postgres_host == "custom_host"
    assert custom_settings.postgres_port == 5433
    assert custom_settings.postgres_user == "custom_user"
    assert custom_settings.postgres_password == "custom_pass"
    assert custom_settings.postgres_db == "custom_db"
    assert custom_settings.db_echo is True

    expected_url = "postgresql+asyncpg://custom_user:custom_pass@custom_host:5433/custom_db"
    assert custom_settings.database_url == expected_url


def test_settings_pool_override(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify database connection pool parameters can be overridden via environment."""
    monkeypatch.setenv("DB_POOL_SIZE", "25")
    monkeypatch.setenv("DB_MAX_OVERFLOW", "50")

    pool_settings = Settings()
    assert pool_settings.db_pool_size == 25
    assert pool_settings.db_max_overflow == 50


def test_settings_extra_fields_forbidden() -> None:
    """Verify that undeclared settings attributes are rejected."""
    with pytest.raises(ValidationError):
        Settings(unknown_key="malicious_payload")  # type: ignore[call-arg]


def test_get_settings_singleton() -> None:
    """Verify get_settings returns a cached singleton instance."""
    settings_first = get_settings()
    settings_second = get_settings()
    assert settings_first is settings_second
    assert isinstance(settings_first, Settings)


def test_database_engine_and_session_factory_creation() -> None:
    """Verify creation of async engine and async sessionmaker."""
    custom_url = "postgresql+asyncpg://user:pass@localhost:5432/testdb"
    test_engine, test_factory = create_engine_and_session_factory(
        database_url=custom_url,
        echo=False,
    )
    assert isinstance(test_engine, AsyncEngine)
    assert test_factory.class_ == AsyncSession
    assert test_engine.url.drivername == "postgresql+asyncpg"


def test_declarative_base_metadata() -> None:
    """Verify DeclarativeBase initialization and metadata registry."""
    assert hasattr(Base, "metadata")
    assert Base.metadata is not None


@pytest.mark.asyncio
async def test_get_db_session_lifecycle() -> None:
    """Verify get_db_session yields an AsyncSession."""
    session_generator = get_db_session()
    session = await anext(session_generator)
    assert isinstance(session, AsyncSession)

    # Clean up generator properly
    try:
        await anext(session_generator)
    except StopAsyncIteration:
        pass


@pytest.mark.asyncio
async def test_get_db_session_rollback_on_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify get_db_session calls rollback when an exception occurs inside the session block."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_cm = AsyncMock()
    mock_cm.__aenter__.return_value = mock_session
    mock_cm.__aexit__.return_value = None
    mock_factory = MagicMock(return_value=mock_cm)

    monkeypatch.setattr("workout_service.src.database.async_session_factory", mock_factory)

    gen = get_db_session()
    session = await anext(gen)
    assert session is mock_session

    with pytest.raises(RuntimeError, match="DB failure"):
        await gen.athrow(RuntimeError("DB failure"))

    mock_session.rollback.assert_awaited_once()


def test_alembic_configuration_files_exist() -> None:
    """Verify presence and validity of Alembic migration configuration files."""
    alembic_ini = PROJECT_ROOT / "workout_service" / "alembic.ini"
    env_py = PROJECT_ROOT / "workout_service" / "alembic" / "env.py"
    script_mako = PROJECT_ROOT / "workout_service" / "alembic" / "script.py.mako"
    versions_dir = PROJECT_ROOT / "workout_service" / "alembic" / "versions"

    assert alembic_ini.is_file(), "alembic.ini is missing"
    assert env_py.is_file(), "alembic/env.py is missing"
    assert script_mako.is_file(), "alembic/script.py.mako is missing"
    assert versions_dir.is_dir(), "alembic/versions directory is missing"

    # Validate alembic.ini loading
    cfg = Config(str(alembic_ini))
    script_location = cfg.get_main_option("script_location")
    assert script_location == "workout_service/alembic"


def test_alembic_offline_sql_generation() -> None:
    """Verify Alembic can successfully generate offline migration SQL for upgrade and downgrade."""
    alembic_ini = PROJECT_ROOT / "workout_service" / "alembic.ini"
    cfg = Config(str(alembic_ini))
    # sql=True triggers offline migration execution
    command.upgrade(cfg, "head", sql=True)
    command.downgrade(cfg, "head:base", sql=True)


def test_alembic_online_migration_cycle() -> None:
    """Verify Alembic migration can be downgraded and upgraded against the database."""
    alembic_ini = PROJECT_ROOT / "workout_service" / "alembic.ini"
    cfg = Config(str(alembic_ini))
    command.downgrade(cfg, "-1")
    command.upgrade(cfg, "head")
    command.current(cfg)


@pytest.mark.asyncio
async def test_workout_health_endpoint() -> None:
    """Verify Workout Service liveness probe returns HTTP 200."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "workout"}


@pytest.mark.asyncio
async def test_workout_ready_endpoint_success() -> None:
    """Verify readiness probe returns HTTP 200 when database query succeeds."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar.return_value = 1
    mock_session.execute.return_value = mock_result

    async def override_get_db_session() -> AsyncMock:
        return mock_session

    app.dependency_overrides[get_db_session] = override_get_db_session

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")

        assert response.status_code == 200
        assert response.json() == {"status": "ready", "database": "connected"}
        mock_session.execute.assert_awaited_once()
        actual_query = mock_session.execute.call_args[0][0]
        assert actual_query.compare(text("SELECT 1"))
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_workout_ready_endpoint_db_failure() -> None:
    """Verify readiness probe returns HTTP 503 when database is unreachable."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.execute.side_effect = ConnectionRefusedError("Database connection timed out")

    async def override_get_db_session() -> AsyncMock:
        return mock_session

    app.dependency_overrides[get_db_session] = override_get_db_session

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")

        assert response.status_code == 503
        data = response.json()
        assert "Database unreachable" in data["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_workout_ready_endpoint_invalid_scalar() -> None:
    """Verify readiness probe returns HTTP 503 when database query returns unexpected value."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar.return_value = 0
    mock_session.execute.return_value = mock_result

    async def override_get_db_session() -> AsyncMock:
        return mock_session

    app.dependency_overrides[get_db_session] = override_get_db_session

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/ready")

        assert response.status_code == 503
        data = response.json()
        assert "invalid response" in data["detail"]
    finally:
        app.dependency_overrides.clear()


def test_workout_service_exports() -> None:
    """Verify all public symbols are exported in workout_service.src."""
    import workout_service.src as workout_module

    expected_exports = {
        "Base",
        "OutboxModel",
        "Settings",
        "WorkoutModel",
        "app",
        "engine",
        "get_db_session",
        "get_settings",
    }
    assert set(workout_module.__all__) == expected_exports
    for symbol in expected_exports:
        assert hasattr(workout_module, symbol)
