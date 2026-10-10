from __future__ import annotations

import logging
from collections.abc import AsyncGenerator

from redis.asyncio import ConnectionPool, Redis

from leaderboard_service.src.core.config import get_settings

logger = logging.getLogger(__name__)

# Global connection pool instance
_redis_pool: ConnectionPool | None = None


def get_redis_pool() -> ConnectionPool:
    """Return the global Redis ConnectionPool singleton, initializing if needed."""
    global _redis_pool
    if _redis_pool is None:
        settings = get_settings()
        _redis_pool = ConnectionPool.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=50,
        )
    return _redis_pool


async def init_redis_pool(url: str | None = None) -> ConnectionPool:
    """Initialize Redis connection pool and verify connectivity."""
    global _redis_pool
    if _redis_pool is not None:
        try:
            await _redis_pool.disconnect()
        except (RuntimeError, OSError):
            pass

    redis_url = url or get_settings().redis_url
    _redis_pool = ConnectionPool.from_url(
        redis_url,
        decode_responses=True,
        max_connections=50,
    )

    client = Redis(connection_pool=_redis_pool)
    try:
        await client.ping()
        logger.info("Redis connection pool initialized successfully")
    except Exception as exc:
        logger.warning("Redis ping failed during pool initialization: %s", exc)
    finally:
        await client.aclose()

    return _redis_pool


async def close_redis_pool() -> None:
    """Gracefully close all connections in the Redis ConnectionPool."""
    global _redis_pool
    if _redis_pool is not None:
        logger.info("Closing Redis connection pool")
        try:
            await _redis_pool.disconnect()
        except (RuntimeError, OSError):
            pass
        _redis_pool = None


def get_redis_client() -> Redis:
    """Create and return a new async Redis client instance using the connection pool."""
    pool = get_redis_pool()
    return Redis(connection_pool=pool)


async def get_redis() -> AsyncGenerator[Redis, None]:
    """Async generator yielding a Redis client from the connection pool.

    Designed for FastAPI dependency injection.
    """
    client = get_redis_client()
    try:
        yield client
    finally:
        await client.aclose()


__all__ = [
    "close_redis_pool",
    "get_redis",
    "get_redis_client",
    "get_redis_pool",
    "init_redis_pool",
]
