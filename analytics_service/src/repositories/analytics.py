from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase

from analytics_service.src.core.config import get_settings
from analytics_service.src.core.database import (
    ensure_timeseries_collection,
    get_mongo_database,
)
from analytics_service.src.schemas.analytics import WorkoutTimeSeriesPoint

logger = logging.getLogger(__name__)


class AnalyticsRepository:
    """Repository for managing workout Time Series documents in MongoDB."""

    def __init__(
        self,
        db: AsyncIOMotorDatabase[dict[str, Any]] | None = None,
        collection_name: str | None = None,
    ) -> None:
        self._db: AsyncIOMotorDatabase[dict[str, Any]] | None = db
        self.collection_name: str = collection_name or get_settings().mongo.collection_name
        self._collection: AsyncIOMotorCollection[dict[str, Any]] | None = None

    @property
    def db(self) -> AsyncIOMotorDatabase[dict[str, Any]]:
        """Return initialized or default AsyncIOMotorDatabase instance."""
        if self._db is None:
            self._db = get_mongo_database()
        return self._db

    async def get_collection(self) -> AsyncIOMotorCollection[dict[str, Any]]:
        """Return or lazily ensure Time Series collection."""
        if self._collection is None:
            self._collection = await ensure_timeseries_collection(
                db=self.db,
                collection_name=self.collection_name,
            )
        return self._collection

    async def save_point(
        self,
        point: WorkoutTimeSeriesPoint | dict[str, Any],
    ) -> str:
        """Insert a Time Series metric point into MongoDB collection.

        Returns the inserted document ID as string.
        """
        col = await self.get_collection()
        if isinstance(point, WorkoutTimeSeriesPoint):
            doc = point.to_mongo_doc()
        else:
            doc = dict(point)

        result = await col.insert_one(doc)
        doc_id = str(result.inserted_id)
        logger.debug(
            "Saved analytics point with ID %s for workout %s",
            doc_id,
            doc.get("metadata", {}).get("workout_id"),
        )
        return doc_id

    async def get_user_metrics(
        self,
        user_id: UUID | str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Retrieve Time Series metric documents for a given user ordered by timestamp DESC."""
        col = await self.get_collection()
        cursor = col.find({"metadata.user_id": str(user_id)}).sort("timestamp", -1).limit(limit)
        return await cursor.to_list(length=limit)

    async def get_workout_metric(
        self,
        workout_id: UUID | str,
    ) -> dict[str, Any] | None:
        """Retrieve metric document for a specific workout ID."""
        col = await self.get_collection()
        doc = await col.find_one({"metadata.workout_id": str(workout_id)})
        return doc


__all__ = ["AnalyticsRepository"]
