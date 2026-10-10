# ==============================================================================
# Multi-Stage Dockerfile for IronTracker Users Service
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder (compile dependencies & create isolated venv)
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies and clean up apt cache immediately
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install wheel
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy shared contracts and service dependencies
COPY shared/contracts/pyproject.toml /build/shared/contracts/pyproject.toml
COPY shared/contracts /build/shared/contracts
COPY users_service/pyproject.toml /build/users_service/pyproject.toml

# Install dependencies into virtualenv
RUN pip install --no-cache-dir -e /build/shared/contracts && \
    pip install --no-cache-dir \
        fastapi>=0.110.0 \
        "uvicorn[standard]>=0.28.0" \
        pydantic>=2.7.0 \
        pydantic-settings>=2.2.0 \
        "sqlalchemy[asyncio]>=2.0.28" \
        asyncpg>=0.29.0 \
        alembic>=1.13.0 \
        bcrypt>=4.0.0 \
        pyjwt>=2.8.0 \
        python-dotenv>=1.0.1

# ------------------------------------------------------------------------------
# Stage 2: Runtime (minimal, secure, non-root execution container)
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

# Set runtime environment variables
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Create non-root system user and group (Least Privilege: UID/GID 1000)
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -s /bin/bash -m appuser

WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Copy application source code and shared packages
COPY --chown=appuser:appgroup shared/ /app/shared/
COPY --chown=appuser:appgroup users_service/ /app/users_service/

# Switch to non-root user
USER appuser

# Expose HTTP port for API
EXPOSE 8001

# Default command: run FastAPI application via uvicorn
CMD ["python", "-m", "uvicorn", "users_service.src.main:app", "--host", "0.0.0.0", "--port", "8001"]
