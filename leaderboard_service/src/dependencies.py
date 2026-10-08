from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis

from leaderboard_service.src.core.config import Settings, get_settings
from leaderboard_service.src.core.redis import get_redis

# Type annotations for dependency injection
RedisDep = Annotated[Redis, Depends(get_redis)]
SettingsDep = Annotated[Settings, Depends(get_settings)]

__all__ = [
    "RedisDep",
    "SettingsDep",
    "get_redis",
    "get_settings",
]
