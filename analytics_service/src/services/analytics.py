from __future__ import annotations

import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from analytics_service.src.repositories.analytics import AnalyticsRepository
from analytics_service.src.schemas.analytics import WorkoutTimeSeriesPoint
from shared.contracts.src.events import WorkoutCompletedEvent

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for computing workout macro-metrics and persisting to MongoDB Time Series."""

    def __init__(
        self,
        repository: AnalyticsRepository | None = None,
        db: AsyncIOMotorDatabase[dict[str, Any]] | None = None,
    ) -> None:
        self.repository: AnalyticsRepository = repository or AnalyticsRepository(db=db)

    async def process_workout_completed_event(
        self,
        event: WorkoutCompletedEvent,
    ) -> WorkoutTimeSeriesPoint:
        """Process WorkoutCompletedEvent, compute 1RM and tonnage, and persist to MongoDB."""
        point = WorkoutTimeSeriesPoint.from_event(event)
        doc_id = await self.repository.save_point(point)
        point.id = doc_id
        logger.info(
            "Persisted workout analytics point for workout %s (user %s): 1RM=%s, tonnage=%.2f",
            event.workout_id,
            event.user_id,
            point.one_rep_max,
            point.tonnage,
        )
        return point


__all__ = ["AnalyticsService"]
