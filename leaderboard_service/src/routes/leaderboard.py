from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Query, status
from redis.exceptions import RedisError

from leaderboard_service.src.dependencies import (
    CurrentUserIdDep,
    LeaderboardServiceDep,
)
from leaderboard_service.src.schemas.leaderboard import (
    LeaderboardResponse,
    UserRankResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


@router.get(
    "/tonnage",
    response_model=LeaderboardResponse,
    summary="Get tonnage leaderboard",
    description=(
        "Retrieve paginated leaderboard ranked by total tonnage lifted in descending order."
    ),
    operation_id="get_tonnage_leaderboard",
    responses={
        status.HTTP_200_OK: {
            "model": LeaderboardResponse,
            "description": "Successfully retrieved paginated leaderboard entries.",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Redis service is unavailable or encountered a connection error.",
        },
    },
)
async def get_tonnage_leaderboard(
    service: LeaderboardServiceDep,
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=100,
            description="Количество записей для выборки (от 1 до 100)",
        ),
    ] = 10,
    offset: Annotated[
        int,
        Query(
            ge=0,
            description="Смещение для пагинации (начиная с 0)",
        ),
    ] = 0,
) -> LeaderboardResponse:
    """Return paginated leaderboard for total tonnage lifted."""
    try:
        return await service.get_tonnage_leaderboard(limit=limit, offset=offset)
    except (RedisError, ConnectionError, TimeoutError, OSError) as exc:
        logger.error("Redis failure during get_tonnage_leaderboard: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis service unavailable",
        ) from exc


@router.get(
    "/me",
    response_model=UserRankResponse,
    summary="Get current authenticated athlete tonnage rank",
    description=(
        "Retrieve ranking position and total tonnage score for "
        "the authenticated user from JWT token."
    ),
    operation_id="get_my_tonnage_rank",
)
async def get_my_tonnage_rank(
    current_user_id: CurrentUserIdDep,
    service: LeaderboardServiceDep,
) -> UserRankResponse:
    """Return ranking position and tonnage score for the authenticated athlete."""
    try:
        return await service.get_user_tonnage_rank(user_id=current_user_id)
    except (RedisError, ConnectionError, TimeoutError, OSError) as exc:
        logger.error(
            "Redis failure during get_my_tonnage_rank for user %s: %s",
            current_user_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis service unavailable",
        ) from exc


@router.get(
    "/tonnage/users/{user_id}",
    response_model=UserRankResponse,
    summary="Get user tonnage rank",
    description=(
        "Retrieve ranking position (1-indexed) and total tonnage score for a specific user."
    ),
    operation_id="get_user_tonnage_rank",
    responses={
        status.HTTP_200_OK: {
            "model": UserRankResponse,
            "description": "Successfully retrieved user rank and score.",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Redis service is unavailable or encountered a connection error.",
        },
    },
)
async def get_user_tonnage_rank(
    user_id: Annotated[UUID, Path(description="Идентификатор пользователя")],
    service: LeaderboardServiceDep,
) -> UserRankResponse:
    """Return ranking position and tonnage score for a single user."""
    try:
        return await service.get_user_tonnage_rank(user_id=user_id)
    except (RedisError, ConnectionError, TimeoutError, OSError) as exc:
        logger.error("Redis failure during get_user_tonnage_rank for user %s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis service unavailable",
        ) from exc


__all__ = ["router"]
