from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis

from leaderboard_service.src.core.config import Settings, get_settings
from leaderboard_service.src.core.redis import get_redis
from leaderboard_service.src.services.leaderboard import LeaderboardService

# Type annotations for dependency injection
RedisDep = Annotated[Redis, Depends(get_redis)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_leaderboard_service(
    redis: RedisDep,
    settings: SettingsDep,
) -> LeaderboardService:
    """Provide LeaderboardService instance with injected Redis client and settings."""
    return LeaderboardService(redis=redis, settings=settings)


LeaderboardServiceDep = Annotated[LeaderboardService, Depends(get_leaderboard_service)]

__all__ = [
    "LeaderboardServiceDep",
    "RedisDep",
    "SettingsDep",
    "get_leaderboard_service",
    "get_redis",
    "get_settings",
]
