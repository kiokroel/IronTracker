from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from analytics_service.src.core.config import settings
from analytics_service.src.core.database import (
    close_mongo_client,
    ensure_timeseries_collection,
    init_mongo_client,
)
from analytics_service.src.dependencies import MongoDbDep
from analytics_service.src.schemas.health import (
    HealthResponse,
    ReadyErrorResponse,
    ReadyResponse,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for graceful startup and shutdown of analytics resources."""
    logger.info("Starting up IronTracker Analytics Service...")
    await init_mongo_client()
    try:
        await ensure_timeseries_collection()
    except Exception as exc:
        logger.warning("Could not ensure timeseries collection during lifespan startup: %s", exc)

    try:
        yield
    finally:
        logger.info("Shutting down IronTracker Analytics Service...")
        await close_mongo_client()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description=(
        "Analytics service for heavy athletics macro-metrics and Time Series storage in MongoDB"
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/health",
    tags=["Monitoring"],
    summary="Liveness Probe",
    description="Liveness probe endpoint confirming that Analytics Service process is alive.",
    response_model=HealthResponse,
    responses={
        status.HTTP_200_OK: {
            "model": HealthResponse,
            "description": "Service is live and healthy",
        }
    },
)
async def health_check() -> HealthResponse:
    """Liveness probe endpoint returning basic operational health status."""
    return HealthResponse(status="ok", service="analytics")


@app.get(
    "/ready",
    tags=["Monitoring"],
    response_model=ReadyResponse,
    summary="Readiness Probe",
    description="Readiness probe verifying MongoDB database connectivity via ping command.",
    responses={
        status.HTTP_200_OK: {
            "model": ReadyResponse,
            "description": "Service is ready and MongoDB is connected",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ReadyErrorResponse,
            "description": "MongoDB is unreachable or service is not ready",
        },
    },
)
async def readiness_check(
    db: MongoDbDep,
) -> ReadyResponse | JSONResponse:
    """Readiness probe endpoint verifying MongoDB connectivity."""
    try:
        # Check connectivity via ping command on database
        ping_res = await db.command("ping")
        if not ping_res or ping_res.get("ok") != 1:
            error_data = ReadyErrorResponse(
                status="unavailable",
                database="disconnected",
                mongodb="disconnected",
                detail="MongoDB ping returned unexpected response",
            )
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content=error_data.model_dump(),
            )
        return ReadyResponse(status="ready", database="connected", mongodb="connected")
    except Exception as exc:
        logger.error("Readiness check failed: %s", exc)
        error_data = ReadyErrorResponse(
            status="unavailable",
            database="disconnected",
            mongodb="disconnected",
            detail=f"MongoDB connection failed: {exc}",
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=error_data.model_dump(),
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.APP_HOST,
        port=settings.APP_PORT,
    )
