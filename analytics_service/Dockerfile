# IronTracker Analytics Service
# Base Dockerfile stub for service containerization

# ==============================================================================
# Stage 1: Builder (Dependency compilation & virtual environment)
# ==============================================================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Build optimizations
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies for compiling binary wheels if needed, clean apt cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Create isolated virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and packaging tools
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install dependencies from shared contracts and analytics service pyproject.toml
COPY shared/contracts/pyproject.toml /build/shared_contracts/
RUN pip install --no-cache-dir /build/shared_contracts

COPY analytics_service/pyproject.toml /build/analytics_service/
RUN pip install --no-cache-dir /build/analytics_service

# ==============================================================================
# Stage 2: Runtime (Minimal production image)
# ==============================================================================
FROM python:3.12-slim AS runtime

# Security: Create non-root user and group appuser:appgroup (UID/GID 1000)
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -m -s /bin/bash appuser && \
    mkdir -p /app && \
    chown -R appuser:appgroup /app

WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder --chown=appuser:appgroup /opt/venv /opt/venv

# Configure runtime environment variables
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy application source code and shared contracts
COPY --chown=appuser:appgroup shared /app/shared
COPY --chown=appuser:appgroup analytics_service /app/analytics_service

# Switch to non-privileged user
USER appuser

# Expose HTTP port for API Service
EXPOSE 8003

# Default command: FastAPI server (can be overridden in docker-compose for workers)
CMD ["python", "-m", "uvicorn", "analytics_service.src.main:app", "--host", "0.0.0.0", "--port", "8003"]
