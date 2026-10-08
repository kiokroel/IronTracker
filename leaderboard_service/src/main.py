from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from leaderboard_service.src.core.config import settings
from leaderboard_service.src.core.redis import close_redis_pool, init_redis_pool
from leaderboard_service.src.dependencies import get_redis
from leaderboard_service.src.routes import router
from leaderboard_service.src.schemas.health import (
    HealthResponse,
    ReadyErrorResponse,
    ReadyResponse,
)
from leaderboard_service.src.services.consumer import WorkoutEventConsumer

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for graceful startup and shutdown of resources."""
    logger.info("Starting up IronTracker Leaderboard Service...")
    await init_redis_pool()
    consumer: WorkoutEventConsumer | None = None
    consumer_task: asyncio.Task[None] | None = None
    consumer_stop_event: asyncio.Event | None = None

    if settings.enable_kafka_consumer:
        logger.info("Enabling background Kafka consumer in lifespan...")
        consumer_stop_event = asyncio.Event()
        consumer = WorkoutEventConsumer(settings=settings)
        await consumer.start()
        consumer_task = asyncio.create_task(consumer.consume(stop_event=consumer_stop_event))

    try:
        yield
    finally:
        logger.info("Shutting down IronTracker Leaderboard Service...")
        if consumer_stop_event is not None:
            consumer_stop_event.set()
        if consumer_task is not None:
            try:
                await asyncio.wait_for(consumer_task, timeout=5.0)
            except (TimeoutError, asyncio.CancelledError):
                consumer_task.cancel()
        if consumer is not None:
            await consumer.stop()
        await close_redis_pool()


app = FastAPI(
    title="IronTracker Leaderboard Service",
    description="Service for real-time ranking and leaderboards using Redis ZSET",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount application domain routes with /api/v1 prefix
app.include_router(router)


@app.get(
    "/health",
    tags=["Monitoring"],
    response_model=HealthResponse,
    summary="Liveness probe",
    description="Liveness probe endpoint verifying that the service process is running.",
)
async def health_check() -> HealthResponse:
    """Health check endpoint for Leaderboard Service."""
    return HealthResponse(status="ok", service="leaderboard")


@app.get(
    "/ready",
    tags=["Monitoring"],
    response_model=ReadyResponse,
    summary="Readiness probe",
    description="Readiness probe verifying Redis connectivity via PING command.",
    responses={
        status.HTTP_200_OK: {
            "model": ReadyResponse,
            "description": "Service is ready and Redis is connected",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ReadyErrorResponse,
            "description": "Redis is unreachable or service is not ready",
        },
    },
)
async def readiness_check(
    redis_client: Annotated[Redis, Depends(get_redis)],
) -> ReadyResponse | JSONResponse:
    """Readiness probe endpoint verifying Redis connectivity via PING."""
    try:
        ping_ok = await redis_client.ping()
        if not ping_ok:
            error_data = ReadyErrorResponse(
                status="unavailable",
                redis="disconnected",
                detail="Redis PING returned unexpected response",
            )
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content=error_data.model_dump(),
            )
        return ReadyResponse(status="ready", redis="connected")
    except Exception as exc:
        logger.error("Readiness check failed: %s", exc)
        error_data = ReadyErrorResponse(
            status="unavailable",
            redis="disconnected",
            detail=f"Redis connection failed: {exc}",
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
