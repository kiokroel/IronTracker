from __future__ import annotations

import os
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, Header, HTTPException, status
from redis.asyncio import Redis

from leaderboard_service.src.core.config import Settings, get_settings
from leaderboard_service.src.core.redis import get_redis
from leaderboard_service.src.services.leaderboard import LeaderboardService

# Secret key matching users_service for stateless token decoding
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "irontracker_super_secure_jwt_secret_key_2026_dev")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

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


async def get_current_user_id(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
) -> UUID:
    """Extract authenticated athlete UUID from Bearer JWT or X-User-ID."""
    if authorization is not None and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            sub = payload.get("sub")
            if sub:
                return UUID(str(sub))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired authentication token: {exc}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    if x_user_id is not None:
        try:
            return UUID(x_user_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid UUID format in X-User-ID header",
            ) from exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


CurrentUserIdDep = Annotated[UUID, Depends(get_current_user_id)]

__all__ = [
    "CurrentUserIdDep",
    "LeaderboardServiceDep",
    "RedisDep",
    "SettingsDep",
    "get_current_user_id",
    "get_leaderboard_service",
    "get_redis",
    "get_settings",
]
