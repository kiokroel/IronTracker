from __future__ import annotations

import logging
from typing import Any, cast
from uuid import UUID

from redis.asyncio import Redis

from leaderboard_service.src.core.config import Settings, get_settings
from leaderboard_service.src.schemas.leaderboard import (
    LeaderboardEntry,
    LeaderboardResponse,
    UserRankResponse,
)

logger = logging.getLogger(__name__)


class LeaderboardService:
    """Service for querying leaderboards and user ranks directly from Redis ZSET.

    Strictly delegates sorting and ranking calculations to Redis commands
    (ZCARD, ZRANGE, ZREVRANK, ZSCORE), avoiding in-memory Python calculations.
    """

    def __init__(self, redis: Redis, settings: Settings | None = None) -> None:
        """Initialize LeaderboardService with Redis client and configuration."""
        self.redis = redis
        self.settings = settings or get_settings()

    async def get_tonnage_leaderboard(
        self,
        limit: int = 10,
        offset: int = 0,
    ) -> LeaderboardResponse:
        """Retrieve paginated leaderboard ordered by total tonnage lifted.

        Uses Redis ZCARD for total count and ZRANGE with desc=True, withscores=True
        for high-performance server-side ranked pagination.
        """
        key = self.settings.leaderboard_tonnage_key
        total_card = await self.redis.zcard(key)
        total_entries = int(total_card) if total_card is not None else 0

        if total_entries == 0 or limit <= 0 or offset >= total_entries:
            return LeaderboardResponse(
                metric="tonnage",
                total_entries=total_entries,
                entries=[],
            )

        # Retrieve ranked members in descending score order using 0-based offset range
        start = max(0, offset)
        stop = start + limit - 1
        raw_result = await self.redis.zrange(
            name=key,
            start=start,
            end=stop,
            desc=True,
            withscores=True,
        )
        typed_items = cast(list[tuple[Any, Any]], raw_result)

        entries: list[LeaderboardEntry] = []
        for index, item in enumerate(typed_items):
            member, score = item
            member_str = member.decode("utf-8") if isinstance(member, bytes) else str(member)
            try:
                user_uuid = UUID(member_str)
            except (ValueError, TypeError):
                logger.warning(
                    "Invalid UUID member format '%s' encountered in Redis key '%s'",
                    member_str,
                    key,
                )
                continue

            entry = LeaderboardEntry(
                rank=start + index + 1,
                user_id=user_uuid,
                score=max(0.0, float(score)),
            )
            entries.append(entry)

        return LeaderboardResponse(
            metric="tonnage",
            total_entries=total_entries,
            entries=entries,
        )

    async def get_user_tonnage_rank(self, user_id: UUID) -> UserRankResponse:
        """Retrieve individual user ranking position and total tonnage score.

        Uses Redis ZREVRANK (0-indexed converted to 1-indexed) and ZSCORE.
        Returns rank=None and score=0.0 when user has no entries.
        """
        key = self.settings.leaderboard_tonnage_key
        user_str = str(user_id)

        raw_rank = await self.redis.zrevrank(key, user_str)
        raw_score = await self.redis.zscore(key, user_str)

        rank: int | None = None
        if raw_rank is not None and isinstance(raw_rank, (int, str)):
            rank = int(raw_rank) + 1

        score: float = float(raw_score) if raw_score is not None else 0.0

        return UserRankResponse(
            user_id=user_id,
            rank=rank,
            score=max(0.0, score),
        )


__all__ = ["LeaderboardService"]
