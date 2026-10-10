from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest
import yaml

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOCKER_COMPOSE_PATH = PROJECT_ROOT / "docker-compose.yml"

SERVICE_DOCKERFILES: dict[str, Path] = {
    "workout_service": PROJECT_ROOT / "workout_service" / "Dockerfile",
    "leaderboard_service": PROJECT_ROOT / "leaderboard_service" / "Dockerfile",
    "analytics_service": PROJECT_ROOT / "analytics_service" / "Dockerfile",
    "notification_service": PROJECT_ROOT / "notification_service" / "Dockerfile",
    "users_service": PROJECT_ROOT / "users_service" / "Dockerfile",
}

EXPECTED_APP_SERVICES: list[str] = [
    "workout-service",
    "workout-outbox-processor",
    "leaderboard-service",
    "leaderboard-consumer",
    "analytics-worker",
    "notification-worker",
    "users-service",
]

EXPECTED_INFRA_SERVICES: list[str] = [
    "postgres",
    "redis",
    "mongodb",
    "kafka",
    "rabbitmq",
]


# ==============================================================================
# 1. Dockerfile Multi-Stage & Security Standards Tests
# ==============================================================================


@pytest.mark.parametrize("service_name,dockerfile_path", list(SERVICE_DOCKERFILES.items()))
def test_dockerfile_exists_and_is_non_empty(service_name: str, dockerfile_path: Path) -> None:
    """Verify that Dockerfile exists for each microservice and is non-empty."""
    assert dockerfile_path.is_file(), f"Dockerfile is missing for {service_name}: {dockerfile_path}"
    content = dockerfile_path.read_text(encoding="utf-8").strip()
    assert len(content) > 0, f"Dockerfile is empty for {service_name}"


@pytest.mark.parametrize("service_name,dockerfile_path", list(SERVICE_DOCKERFILES.items()))
def test_dockerfile_base_image_python312_slim(service_name: str, dockerfile_path: Path) -> None:
    """Verify that Dockerfile uses official python:3.12-slim base image."""
    content = dockerfile_path.read_text(encoding="utf-8")
    assert "FROM python:3.12-slim" in content, (
        f"Dockerfile for {service_name} must use python:3.12-slim as base image"
    )


@pytest.mark.parametrize("service_name,dockerfile_path", list(SERVICE_DOCKERFILES.items()))
def test_dockerfile_multistage_builder_and_runtime(
    service_name: str, dockerfile_path: Path
) -> None:
    """Verify multi-stage architecture with builder and runtime stages."""
    content = dockerfile_path.read_text(encoding="utf-8")

    # Verify builder stage
    assert re.search(r"FROM\s+python:3\.12-slim\s+AS\s+builder", content, re.IGNORECASE), (
        f"Dockerfile for {service_name} must declare: FROM python:3.12-slim AS builder"
    )

    # Verify runtime stage
    assert re.search(r"FROM\s+python:3\.12-slim\s+AS\s+runtime", content, re.IGNORECASE), (
        f"Dockerfile for {service_name} must declare: FROM python:3.12-slim AS runtime"
    )

    # Verify venv copy from builder to runtime
    assert re.search(r"COPY\s+--from=builder\s+.*(?:\/opt\/venv)", content), (
        f"Dockerfile for {service_name} must copy /opt/venv from builder stage"
    )


@pytest.mark.parametrize("service_name,dockerfile_path", list(SERVICE_DOCKERFILES.items()))
def test_dockerfile_non_root_user_security(service_name: str, dockerfile_path: Path) -> None:
    """Verify non-privileged appuser (UID 1000) execution without root permissions."""
    content = dockerfile_path.read_text(encoding="utf-8")

    assert "appuser" in content, f"Dockerfile for {service_name} must define appuser"
    assert "1000" in content, f"Dockerfile for {service_name} must specify UID/GID 1000"
    assert "USER appuser" in content, f"Dockerfile for {service_name} must switch to USER appuser"
    assert "USER root" not in content.split("USER appuser")[-1], (
        f"Dockerfile for {service_name} must not elevate back to root after switching"
    )


@pytest.mark.parametrize("service_name,dockerfile_path", list(SERVICE_DOCKERFILES.items()))
def test_dockerfile_environment_variables(service_name: str, dockerfile_path: Path) -> None:
    """Verify required environment variables (PATH, PYTHONPATH, UNBUFFERED, DONTWRITEBYTECODE)."""
    content = dockerfile_path.read_text(encoding="utf-8")

    assert "/opt/venv/bin" in content, (
        f"Dockerfile for {service_name} must configure /opt/venv/bin in PATH"
    )
    assert "PYTHONPATH" in content and "/app" in content, (
        f"Dockerfile for {service_name} must set PYTHONPATH to /app"
    )
    assert "PYTHONUNBUFFERED=1" in content, (
        f"Dockerfile for {service_name} must set PYTHONUNBUFFERED=1"
    )
    assert "PYTHONDONTWRITEBYTECODE=1" in content, (
        f"Dockerfile for {service_name} must set PYTHONDONTWRITEBYTECODE=1"
    )


@pytest.mark.parametrize("service_name,dockerfile_path", list(SERVICE_DOCKERFILES.items()))
def test_dockerfile_dependency_installation(service_name: str, dockerfile_path: Path) -> None:
    """Verify dependencies are installed from service pyproject.toml and shared contracts."""
    content = dockerfile_path.read_text(encoding="utf-8")

    assert "shared/contracts/pyproject.toml" in content or "shared_contracts" in content, (
        f"Dockerfile for {service_name} must install shared contracts dependencies"
    )
    assert f"{service_name}/pyproject.toml" in content, (
        f"Dockerfile for {service_name} must install service-specific dependencies"
    )


@pytest.mark.parametrize("service_name,dockerfile_path", list(SERVICE_DOCKERFILES.items()))
def test_dockerfile_no_hardcoded_secrets(service_name: str, dockerfile_path: Path) -> None:
    """Verify Dockerfile contains no hardcoded passwords, tokens, or credentials."""
    content = dockerfile_path.read_text(encoding="utf-8")

    forbidden_patterns = [
        r"password\s*=\s*['\"][^'\"]+['\"]",
        r"secret\s*=\s*['\"][^'\"]+['\"]",
        r"token\s*=\s*['\"][^'\"]+['\"]",
        r"api_key\s*=\s*['\"][^'\"]+['\"]",
    ]
    for pattern in forbidden_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        assert len(matches) == 0, (
            f"Potential hardcoded secret found in {service_name} Dockerfile: {matches}"
        )


@pytest.mark.parametrize("service_name,dockerfile_path", list(SERVICE_DOCKERFILES.items()))
def test_dockerfile_cmd_structure(service_name: str, dockerfile_path: Path) -> None:
    """Verify Dockerfile defines a default CMD in valid exec JSON array format."""
    content = dockerfile_path.read_text(encoding="utf-8")

    cmd_matches = re.findall(r"CMD\s+\[(.*?)\]", content)
    assert len(cmd_matches) >= 1, (
        f"Dockerfile for {service_name} must specify default CMD using exec array format"
    )


# ==============================================================================
# 2. Docker Compose Configuration Tests
# ==============================================================================


@pytest.fixture(scope="module")
def compose_config() -> dict[str, Any]:
    """Load and parse docker-compose.yml configuration."""
    assert DOCKER_COMPOSE_PATH.is_file(), "docker-compose.yml must exist"
    data = yaml.safe_load(DOCKER_COMPOSE_PATH.read_text(encoding="utf-8"))
    assert isinstance(data, dict), "docker-compose.yml root must be a YAML mapping"
    return data


def test_compose_contains_all_application_services(compose_config: dict[str, Any]) -> None:
    """Verify that docker-compose.yml contains all 6 required application services."""
    services = compose_config.get("services", {})
    assert isinstance(services, dict)

    for app_svc in EXPECTED_APP_SERVICES:
        assert app_svc in services, (
            f"Application service '{app_svc}' must be defined in docker-compose.yml"
        )


def test_compose_contains_all_infra_services(compose_config: dict[str, Any]) -> None:
    """Verify that docker-compose.yml contains all required infrastructure services."""
    services = compose_config.get("services", {})
    assert isinstance(services, dict)

    for infra_svc in EXPECTED_INFRA_SERVICES:
        assert infra_svc in services, (
            f"Infra service '{infra_svc}' must be defined in docker-compose.yml"
        )
    assert "caddy" in services, "caddy API gateway must be defined in docker-compose.yml"


@pytest.mark.parametrize("app_svc", EXPECTED_APP_SERVICES)
def test_app_services_build_context_and_dockerfile(
    compose_config: dict[str, Any], app_svc: str
) -> None:
    """Verify that build context is '.' and points to correct Dockerfile."""
    services = compose_config.get("services", {})
    svc_def = services.get(app_svc, {})
    assert isinstance(svc_def, dict)

    build_def = svc_def.get("build")
    assert isinstance(build_def, dict), f"Service '{app_svc}' must define build mapping"
    assert build_def.get("context") == ".", f"Service '{app_svc}' build context must be '.'"

    dockerfile = build_def.get("dockerfile")
    assert isinstance(dockerfile, str), f"Service '{app_svc}' must specify dockerfile path"
    full_dockerfile_path = PROJECT_ROOT / dockerfile
    assert full_dockerfile_path.is_file(), (
        f"Dockerfile for '{app_svc}' does not exist at {full_dockerfile_path}"
    )


@pytest.mark.parametrize("app_svc", EXPECTED_APP_SERVICES)
def test_app_services_network_attachment(compose_config: dict[str, Any], app_svc: str) -> None:
    """Verify that all application services join irontracker-network."""
    services = compose_config.get("services", {})
    svc_def = services.get(app_svc, {})
    assert isinstance(svc_def, dict)

    networks = svc_def.get("networks")
    assert isinstance(networks, list), f"Service '{app_svc}' must specify networks list"
    assert "irontracker-network" in networks, (
        f"Service '{app_svc}' must be connected to irontracker-network"
    )


def test_app_services_depends_on_conditions(compose_config: dict[str, Any]) -> None:
    """Verify that depends_on for application services uses condition: service_healthy."""
    services = compose_config.get("services", {})

    expected_dependencies: dict[str, list[str]] = {
        "workout-service": ["postgres"],
        "workout-outbox-processor": ["postgres", "kafka"],
        "leaderboard-service": ["redis"],
        "leaderboard-consumer": ["redis", "kafka"],
        "analytics-worker": ["mongodb", "kafka"],
        "notification-worker": ["rabbitmq"],
        "users-service": ["postgres"],
    }

    for svc_name, deps in expected_dependencies.items():
        svc_def = services.get(svc_name, {})
        depends_on = svc_def.get("depends_on")
        assert isinstance(depends_on, dict), (
            f"Service '{svc_name}' must declare depends_on as mapping"
        )

        for dep in deps:
            assert dep in depends_on, f"Service '{svc_name}' must depend on '{dep}'"
            dep_config = depends_on[dep]
            assert isinstance(dep_config, dict), f"Dependency '{dep}' of '{svc_name}' must be dict"
            assert dep_config.get("condition") == "service_healthy", (
                f"Dependency '{dep}' of '{svc_name}' must have condition: service_healthy"
            )


def test_caddy_depends_on_app_services(compose_config: dict[str, Any]) -> None:
    """Verify that caddy gateway depends on workout-service and leaderboard-service."""
    services = compose_config.get("services", {})
    caddy_def = services.get("caddy", {})
    assert isinstance(caddy_def, dict)

    depends_on = caddy_def.get("depends_on")
    assert depends_on is not None, "caddy service must declare depends_on"

    if isinstance(depends_on, dict):
        assert "workout-service" in depends_on, "caddy must depend on workout-service"
        assert "leaderboard-service" in depends_on, "caddy must depend on leaderboard-service"
        assert "frontend" in depends_on, "caddy must depend on frontend"
        assert depends_on["frontend"].get("condition") == "service_healthy", (
            "caddy must depend on frontend with condition: service_healthy"
        )
    elif isinstance(depends_on, list):
        assert "workout-service" in depends_on
        assert "leaderboard-service" in depends_on
        assert "frontend" in depends_on
    else:
        pytest.fail("caddy depends_on must be list or mapping")


def test_app_services_command_override(compose_config: dict[str, Any]) -> None:
    """Verify each application service defines an explicit command."""
    services = compose_config.get("services", {})

    expected_commands: dict[str, str] = {
        "workout-service": "workout_service.src.main:app",
        "workout-outbox-processor": "workout_service.src.worker",
        "leaderboard-service": "leaderboard_service.src.main:app",
        "leaderboard-consumer": "leaderboard_service.src.worker",
        "analytics-worker": "analytics_service.src.worker",
        "notification-worker": "notification_service.src.worker",
    }

    for svc_name, cmd_substr in expected_commands.items():
        svc_def = services.get(svc_name, {})
        cmd = svc_def.get("command")
        assert cmd is not None, f"Service '{svc_name}' must define command"
        cmd_str = " ".join(cmd) if isinstance(cmd, list) else str(cmd)
        assert cmd_substr in cmd_str, (
            f"Service '{svc_name}' command should contain '{cmd_substr}', got: {cmd_str}"
        )


def test_compose_top_level_network_and_volumes(compose_config: dict[str, Any]) -> None:
    """Verify top-level networks and volumes definitions."""
    networks = compose_config.get("networks")
    assert isinstance(networks, dict), "Top-level networks must be defined"
    assert "irontracker-network" in networks, "irontracker-network must be declared"

    volumes = compose_config.get("volumes")
    assert isinstance(volumes, dict), "Top-level volumes must be defined"
    assert "postgres_data" in volumes
    assert "redis_data" in volumes
    assert "mongo_data" in volumes
    assert "kafka_data" in volumes
    assert "rabbitmq_data" in volumes
    assert "caddy_data" in volumes
    assert "caddy_config" in volumes


def test_docker_compose_cli_config_validation() -> None:
    """Verify docker compose config CLI command succeeds if docker is available."""
    docker_bin = shutil.which("docker")
    if not docker_bin:
        pytest.skip("Docker CLI is not installed or not in PATH")

    result = subprocess.run(
        [docker_bin, "compose", "config", "--quiet"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, f"docker compose config failed: {result.stderr}"


def test_compose_contains_frontend_service(compose_config: dict[str, Any]) -> None:
    """Verify that frontend service is defined in docker-compose.yml with proper config."""
    services = compose_config.get("services", {})
    assert "frontend" in services, "frontend service must be defined in docker-compose.yml"

    frontend_svc = services["frontend"]
    assert isinstance(frontend_svc, dict)
    assert frontend_svc.get("container_name") == "irontracker-frontend"

    # Build section
    build = frontend_svc.get("build", {})
    assert isinstance(build, dict), "frontend service must define build mapping"
    assert build.get("context") == "./frontend", "frontend build context must be ./frontend"
    assert build.get("dockerfile") == "Dockerfile", "frontend dockerfile must be Dockerfile"

    # Network
    networks = frontend_svc.get("networks", [])
    assert "irontracker-network" in networks, "frontend must join irontracker-network"

    # Healthcheck
    healthcheck = frontend_svc.get("healthcheck")
    assert isinstance(healthcheck, dict), "frontend service must define healthcheck"
    test_cmd = healthcheck.get("test")
    test_str = " ".join(test_cmd) if isinstance(test_cmd, list) else str(test_cmd)
    assert "wget" in test_str and "health" in test_str, (
        f"Frontend healthcheck must verify /health using wget, got: {test_str}"
    )


def test_frontend_dockerfile_multistage_and_configuration() -> None:
    """Verify frontend Dockerfile multi-stage build, base images, and healthcheck."""
    dockerfile_path = PROJECT_ROOT / "frontend" / "Dockerfile"
    assert dockerfile_path.is_file(), "frontend/Dockerfile must exist"
    content = dockerfile_path.read_text(encoding="utf-8")

    # Multi-stage: Builder stage with node:20-alpine
    assert re.search(r"FROM\s+node:20-alpine\s+AS\s+builder", content, re.IGNORECASE), (
        "Stage 1 must be: FROM node:20-alpine AS builder"
    )
    assert "npm ci" in content, "Builder stage must install dependencies via npm ci"
    assert "npm run build" in content, "Builder stage must build bundle via npm run build"

    # Multi-stage: Production static server with caddy:2-alpine
    assert re.search(r"FROM\s+caddy:2-alpine", content, re.IGNORECASE), (
        "Stage 2 must be: FROM caddy:2-alpine"
    )
    assert re.search(r"COPY\s+--from=builder\s+/app/dist\s+/usr/share/caddy", content), (
        "Must copy compiled assets to /usr/share/caddy"
    )
    assert re.search(r"COPY\s+Caddyfile\s+/etc/caddy/Caddyfile", content), (
        "Must copy Caddyfile configuration"
    )
    assert "EXPOSE 80" in content, "Must expose port 80"

    # Healthcheck
    assert "HEALTHCHECK" in content, "Must define container HEALTHCHECK"
    assert "wget" in content and "/health" in content, "HEALTHCHECK must probe /health"
