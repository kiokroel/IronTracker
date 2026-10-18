from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CI_WORKFLOW_PATH = PROJECT_ROOT / ".github" / "workflows" / "ci.yml"


def test_ci_workflow_file_exists() -> None:
    """Verify that .github/workflows/ci.yml exists and is not empty."""
    assert CI_WORKFLOW_PATH.is_file(), f"CI workflow file not found: {CI_WORKFLOW_PATH}"
    content = CI_WORKFLOW_PATH.read_text(encoding="utf-8").strip()
    assert len(content) > 0, "CI workflow file is empty"


def test_ci_workflow_yaml_structure() -> None:
    """Verify that CI workflow file is a valid YAML document with required top-level keys."""
    content = CI_WORKFLOW_PATH.read_text(encoding="utf-8")
    data: Any = yaml.safe_load(content)

    assert isinstance(data, dict), "Workflow YAML must parse as a dictionary"
    assert "name" in data, "Workflow must have a 'name' field"
    # PyYAML may parse 'on' as boolean True unless handled or quoted
    triggers = data.get("on") or data.get(True)
    assert triggers is not None, "Workflow must define triggers ('on')"
    assert "jobs" in data, "Workflow must define 'jobs'"


def test_ci_triggers_configuration() -> None:
    """Verify that CI triggers on push and pull_request to main branch."""
    content = CI_WORKFLOW_PATH.read_text(encoding="utf-8")
    data: Any = yaml.safe_load(content)
    triggers = data.get("on") or data.get(True)
    assert isinstance(triggers, dict), "Triggers must be a dictionary"

    assert "push" in triggers, "CI must trigger on push"
    assert "main" in triggers["push"].get("branches", []), "Push must target 'main' branch"

    assert "pull_request" in triggers, "CI must trigger on pull_request"
    assert "main" in triggers["pull_request"].get("branches", []), (
        "Pull request must target 'main' branch"
    )


def test_ci_jobs_presence() -> None:
    """Verify that all required jobs (backend, frontend, docker) are defined."""
    content = CI_WORKFLOW_PATH.read_text(encoding="utf-8")
    data: dict[str, Any] = yaml.safe_load(content)
    jobs = data.get("jobs", {})

    expected_jobs = ["backend-quality", "frontend-quality", "docker-validation"]
    for job_name in expected_jobs:
        assert job_name in jobs, f"Job '{job_name}' is missing from workflow jobs"


def test_backend_quality_services() -> None:
    """Verify backend-quality job configures postgres, redis, and mongo services."""
    content = CI_WORKFLOW_PATH.read_text(encoding="utf-8")
    data: dict[str, Any] = yaml.safe_load(content)
    backend_job = data["jobs"]["backend-quality"]

    assert "services" in backend_job, "backend-quality job must define services"
    services = backend_job["services"]

    assert "postgres" in services, "PostgreSQL service container is required"
    assert "redis" in services, "Redis service container is required"
    assert "mongo" in services, "MongoDB service container is required"

    # PostgreSQL configuration
    pg_service = services["postgres"]
    assert "postgres:16" in pg_service.get("image", "")

    # Redis configuration
    redis_service = services["redis"]
    assert "redis:7" in redis_service.get("image", "")

    # Mongo configuration
    mongo_service = services["mongo"]
    assert "mongo:7" in mongo_service.get("image", "")


def test_backend_quality_steps_commands() -> None:
    """Verify backend-quality job runs all essential quality, SAST and test commands."""
    content = CI_WORKFLOW_PATH.read_text(encoding="utf-8")
    data: dict[str, Any] = yaml.safe_load(content)
    backend_job = data["jobs"]["backend-quality"]
    steps = backend_job.get("steps", [])

    all_commands = " ".join(step.get("run", "") for step in steps)

    assert "ruff check" in all_commands, "ruff check must be executed in backend job"
    assert "mypy" in all_commands, "mypy must be executed in backend job"
    assert "bandit" in all_commands, "bandit must be executed in backend job"
    assert "pip-audit" in all_commands, "pip-audit must be executed in backend job"
    assert "alembic" in all_commands, "alembic migrations must be executed in backend job"
    assert "pytest" in all_commands, "pytest must be executed in backend job"


def test_frontend_quality_steps() -> None:
    """Verify frontend-quality job runs linting, tests, and build."""
    content = CI_WORKFLOW_PATH.read_text(encoding="utf-8")
    data: dict[str, Any] = yaml.safe_load(content)
    frontend_job = data["jobs"]["frontend-quality"]
    steps = frontend_job.get("steps", [])

    all_commands = " ".join(step.get("run", "") for step in steps)

    assert "npm --prefix frontend ci" in all_commands or "npm" in all_commands
    assert "run lint" in all_commands, "Frontend lint must be executed"
    assert "test" in all_commands, "Frontend tests must be executed"
    assert "run build" in all_commands, "Frontend build must be executed"


def test_docker_validation_steps() -> None:
    """Verify docker-validation job runs compose validation and build."""
    content = CI_WORKFLOW_PATH.read_text(encoding="utf-8")
    data: dict[str, Any] = yaml.safe_load(content)
    docker_job = data["jobs"]["docker-validation"]
    steps = docker_job.get("steps", [])

    all_commands = " ".join(step.get("run", "") for step in steps)

    assert "docker compose config" in all_commands, "docker compose config must be validated"
    assert "docker compose build" in all_commands, "docker compose build must be run"
