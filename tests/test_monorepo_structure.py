from __future__ import annotations

import asyncio
import importlib
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from analytics_service.src import worker as analytics_worker
from leaderboard_service.src.main import app as leaderboard_app
from notification_service.src import worker as notification_worker
from workout_service.src.main import app as workout_app

PROJECT_ROOT = Path(__file__).resolve().parent.parent


@pytest.mark.asyncio
async def test_workout_service_health() -> None:
    """Test workout service healthcheck endpoint using httpx.AsyncClient."""
    transport = ASGITransport(app=workout_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "workout"}


@pytest.mark.asyncio
async def test_leaderboard_service_health() -> None:
    """Test leaderboard service healthcheck endpoint using httpx.AsyncClient."""
    transport = ASGITransport(app=leaderboard_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "leaderboard"}


def test_analytics_worker_status() -> None:
    """Test analytics worker status function."""
    status = analytics_worker.get_service_status()
    assert status == {"status": "ok", "service": "analytics"}


@pytest.mark.asyncio
async def test_analytics_worker_consumer_lifecycle() -> None:
    """Test that analytics consumer starts and stops cleanly via stop_event."""
    stop_event = asyncio.Event()

    consumer_task = asyncio.create_task(analytics_worker.consume_events(stop_event=stop_event))
    await asyncio.sleep(0.01)
    stop_event.set()
    await consumer_task

    assert consumer_task.done()


def test_notification_worker_status() -> None:
    """Test notification worker status function."""
    status = notification_worker.get_service_status()
    assert status == {"status": "ok", "service": "notification"}


@pytest.mark.asyncio
async def test_notification_worker_consumer_lifecycle() -> None:
    """Test that notification consumer starts and stops cleanly via stop_event."""
    stop_event = asyncio.Event()

    consumer_task = asyncio.create_task(notification_worker.consume_messages(stop_event=stop_event))
    await asyncio.sleep(0.01)
    stop_event.set()
    await consumer_task

    assert consumer_task.done()


def test_required_monorepo_files_exist() -> None:
    """Verify that all required monorepo directories, services, and pyproject.toml files exist."""
    required_files = [
        "workout_service/Dockerfile",
        "workout_service/pyproject.toml",
        "workout_service/src/__init__.py",
        "workout_service/src/main.py",
        "workout_service/src/dependencies.py",
        "workout_service/src/core/__init__.py",
        "workout_service/src/core/config.py",
        "workout_service/src/core/database.py",
        "workout_service/src/models/__init__.py",
        "workout_service/src/models/workout.py",
        "workout_service/src/models/outbox.py",
        "workout_service/src/schemas/__init__.py",
        "workout_service/src/schemas/workout.py",
        "workout_service/src/repositories/__init__.py",
        "workout_service/src/repositories/base.py",
        "workout_service/src/repositories/workout.py",
        "workout_service/src/controllers/__init__.py",
        "workout_service/src/controllers/workout.py",
        "workout_service/src/routes/__init__.py",
        "workout_service/src/routes/workouts.py",
        "leaderboard_service/Dockerfile",
        "leaderboard_service/pyproject.toml",
        "leaderboard_service/src/__init__.py",
        "leaderboard_service/src/main.py",
        "analytics_service/Dockerfile",
        "analytics_service/pyproject.toml",
        "analytics_service/src/__init__.py",
        "analytics_service/src/worker.py",
        "notification_service/Dockerfile",
        "notification_service/pyproject.toml",
        "notification_service/src/__init__.py",
        "notification_service/src/worker.py",
        "shared/__init__.py",
        "shared/contracts/pyproject.toml",
        "shared/contracts/src/__init__.py",
        ".ruff.toml",
    ]

    for rel_path in required_files:
        full_path = PROJECT_ROOT / rel_path
        assert full_path.exists(), f"Missing required file: {rel_path}"

    service_dirs = [
        "workout_service",
        "leaderboard_service",
        "analytics_service",
        "notification_service",
    ]
    for s_dir in service_dirs:
        svc_path = PROJECT_ROOT / s_dir
        assert (svc_path / "Dockerfile").is_file(), f"Missing Dockerfile in {s_dir}"
        assert (svc_path / "pyproject.toml").is_file(), f"Missing pyproject.toml in {s_dir}"
        assert (svc_path / "src").is_dir(), f"Missing src directory in {s_dir}"

    assert not (PROJECT_ROOT / "services").exists(), (
        "Legacy services/ directory must be deleted; root <service>_service/ layout is used"
    )
    assert not (PROJECT_ROOT / "requirements.txt").exists(), (
        "Legacy requirements.txt must not exist; each service uses pyproject.toml"
    )

    flat_files = [
        "workout_service/src/config.py",
        "workout_service/src/database.py",
        "workout_service/src/models.py",
    ]
    for flat_file in flat_files:
        assert not (PROJECT_ROOT / flat_file).exists(), (
            f"Flat file {flat_file} must not exist; layered VKR architecture is required"
        )


def test_service_pyproject_configurations() -> None:
    """Verify that each microservice has independent pyproject.toml with required dependencies."""
    service_configs = {
        "workout_service/pyproject.toml": [
            "fastapi",
            "sqlalchemy",
            "asyncpg",
            "alembic",
            "aiokafka",
            "pydantic",
        ],
        "leaderboard_service/pyproject.toml": ["fastapi", "redis", "pydantic"],
        "analytics_service/pyproject.toml": ["motor", "aiokafka", "pydantic"],
        "notification_service/pyproject.toml": ["aio-pika", "pydantic"],
        "shared/contracts/pyproject.toml": ["pydantic"],
    }

    for rel_path, expected_deps in service_configs.items():
        file_path = PROJECT_ROOT / rel_path
        assert file_path.exists(), f"Missing {rel_path}"
        content = file_path.read_text(encoding="utf-8")
        assert "[project]" in content, f"{rel_path} must define a [project] table"
        for dep in expected_deps:
            assert dep in content, f"Missing dependency '{dep}' in {rel_path}"


def test_all_modules_can_be_imported() -> None:
    """Verify that all required packages and modules can be imported without errors."""
    modules_to_import = [
        "workout_service.src",
        "workout_service.src.main",
        "workout_service.src.dependencies",
        "workout_service.src.core",
        "workout_service.src.core.config",
        "workout_service.src.core.database",
        "workout_service.src.models",
        "workout_service.src.models.workout",
        "workout_service.src.models.outbox",
        "workout_service.src.schemas",
        "workout_service.src.schemas.workout",
        "workout_service.src.repositories",
        "workout_service.src.repositories.base",
        "workout_service.src.repositories.workout",
        "workout_service.src.controllers",
        "workout_service.src.controllers.workout",
        "workout_service.src.routes",
        "workout_service.src.routes.workouts",
        "leaderboard_service.src",
        "leaderboard_service.src.main",
        "analytics_service.src",
        "analytics_service.src.worker",
        "notification_service.src",
        "notification_service.src.worker",
        "shared",
        "shared.contracts.src",
    ]

    for module_name in modules_to_import:
        mod = importlib.import_module(module_name)
        assert mod is not None, f"Failed to import {module_name}"


def test_future_annotations_in_all_python_files() -> None:
    """Verify all python files in the monorepo start with future annotations."""
    target_dirs = [
        "workout_service",
        "leaderboard_service",
        "analytics_service",
        "notification_service",
        "shared",
        "tests",
    ]
    py_files: list[Path] = []

    for target_dir in target_dirs:
        dir_path = PROJECT_ROOT / target_dir
        if dir_path.exists():
            py_files.extend(dir_path.rglob("*.py"))

    assert len(py_files) > 0, "No python files found to validate"

    for py_file in py_files:
        content = py_file.read_text(encoding="utf-8")
        lines = [
            line.strip()
            for line in content.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]
        assert len(lines) > 0, f"File {py_file} is empty"
        assert lines[0] == "from __future__ import annotations", (
            f"File {py_file} must have future annotations as first statement, got: {lines[0]}"
        )


def test_ruff_configuration_file() -> None:
    """Verify .ruff.toml contains required linting and formatting configuration."""
    ruff_file = PROJECT_ROOT / ".ruff.toml"
    assert ruff_file.exists()

    content = ruff_file.read_text(encoding="utf-8")
    assert "line-length = 100" in content
    assert 'target-version = "py312"' in content
    assert '"E"' in content
    assert '"F"' in content
    assert '"W"' in content
    assert '"I"' in content
    assert '"B"' in content
    assert '"UP"' in content


@pytest.mark.asyncio
async def test_workout_service_health_invalid_method() -> None:
    """Verify that workout health endpoint rejects unsupported HTTP methods."""
    transport = ASGITransport(app=workout_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/health")
    assert response.status_code == 405


@pytest.mark.asyncio
async def test_leaderboard_service_health_invalid_method() -> None:
    """Verify that leaderboard health endpoint rejects unsupported HTTP methods."""
    transport = ASGITransport(app=leaderboard_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/health")
    assert response.status_code == 405


@pytest.mark.asyncio
async def test_services_unknown_route_returns_404() -> None:
    """Verify that nonexistent endpoints return 404 on both services."""
    for app in [workout_app, leaderboard_app]:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/nonexistent-route")
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_analytics_worker_cancellation() -> None:
    """Test analytics worker handles task cancellation gracefully."""
    stop_event = asyncio.Event()
    task = asyncio.create_task(analytics_worker.consume_events(stop_event=stop_event))
    await asyncio.sleep(0.01)
    task.cancel()
    await task
    assert task.done()


@pytest.mark.asyncio
async def test_notification_worker_cancellation() -> None:
    """Test notification worker handles task cancellation gracefully."""
    stop_event = asyncio.Event()
    task = asyncio.create_task(notification_worker.consume_messages(stop_event=stop_event))
    await asyncio.sleep(0.01)
    task.cancel()
    await task
    assert task.done()


@pytest.mark.asyncio
async def test_workers_single_pass_execution() -> None:
    """Verify that workers without stop_event execute single pass and return cleanly."""
    await analytics_worker.run_worker(stop_event=None)
    await notification_worker.run_worker(stop_event=None)
    await notification_worker.consume_events(stop_event=None)


def test_no_forbidden_aioredis_imports() -> None:
    """Ensure strict project directive: aioredis library is strictly forbidden."""
    target_dirs = [
        "workout_service",
        "leaderboard_service",
        "analytics_service",
        "notification_service",
        "shared",
    ]
    for target_dir in target_dirs:
        dir_path = PROJECT_ROOT / target_dir
        if dir_path.exists():
            for py_file in dir_path.rglob("*.py"):
                content = py_file.read_text(encoding="utf-8")
                assert "aioredis" not in content, (
                    f"Forbidden import 'aioredis' detected in {py_file}!"
                )


def test_dockerfiles_content() -> None:
    """Verify that all microservice Dockerfiles contain base containerization directives."""
    service_dirs = [
        "workout_service",
        "leaderboard_service",
        "analytics_service",
        "notification_service",
    ]
    for s_dir in service_dirs:
        dockerfile = PROJECT_ROOT / s_dir / "Dockerfile"
        assert dockerfile.is_file(), f"Dockerfile missing in {s_dir}"
        content = dockerfile.read_text(encoding="utf-8").strip()
        assert len(content) > 0, f"Dockerfile in {s_dir} is empty"
        assert "IronTracker" in content, f"Dockerfile in {s_dir} missing IronTracker comment header"


def test_shared_contracts_structure() -> None:
    """Verify structure and content of shared/contracts package."""
    contracts_dir = PROJECT_ROOT / "shared" / "contracts"
    assert (contracts_dir / "pyproject.toml").is_file()
    assert (contracts_dir / "src").is_dir()
    assert (contracts_dir / "src" / "__init__.py").is_file()

    pyproject_content = (contracts_dir / "pyproject.toml").read_text(encoding="utf-8")
    assert "irontracker-shared-contracts" in pyproject_content
    assert "pydantic" in pyproject_content


def test_root_pyproject_configuration() -> None:
    """Verify root pyproject.toml defines required project metadata and tool configs."""
    root_pyproject = PROJECT_ROOT / "pyproject.toml"
    assert root_pyproject.is_file()

    content = root_pyproject.read_text(encoding="utf-8")
    assert 'requires-python = ">=3.12"' in content
    assert "[tool.ruff]" in content
    assert "[tool.mypy]" in content
    assert "strict = true" in content
    assert "explicit_package_bases = true" in content
    assert "[tool.pytest.ini_options]" in content
    assert 'testpaths = ["tests"]' in content
