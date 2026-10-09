from __future__ import annotations

import asyncio
import inspect
import json
import logging
from typing import Any

from aiokafka import AIOKafkaConsumer
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pydantic import ValidationError

from analytics_service.src.core.config import Settings, get_settings
from analytics_service.src.core.database import (
    close_mongo_client,
    get_mongo_database,
    init_mongo_client,
)
from analytics_service.src.schemas.analytics import WorkoutTimeSeriesPoint
from analytics_service.src.services.analytics import AnalyticsService
from shared.contracts.src.events import WorkoutCompletedEvent

logger = logging.getLogger(__name__)


class AnalyticsEventConsumer:
    """Kafka consumer that listens for workout events and saves metrics to MongoDB Time Series."""

    def __init__(
        self,
        settings: Settings | None = None,
        consumer: AIOKafkaConsumer | None = None,
        mongo_client: AsyncIOMotorClient[dict[str, Any]] | None = None,
        database: AsyncIOMotorDatabase[dict[str, Any]] | None = None,
        analytics_service: AnalyticsService | None = None,
    ) -> None:
        self.settings: Settings = settings or get_settings()
        self.consumer: AIOKafkaConsumer | None = consumer
        self._owns_consumer: bool = consumer is None
        self.mongo_client: AsyncIOMotorClient[dict[str, Any]] | None = mongo_client
        self._owns_mongo: bool = mongo_client is None and database is None
        self.database: AsyncIOMotorDatabase[dict[str, Any]] | None = database
        self.analytics_service: AnalyticsService | None = analytics_service
        self._running: bool = False

    async def start(self) -> None:
        """Initialize MongoDB, ensure Time Series collection, and start Kafka consumer."""
        if self.database is None:
            if self.mongo_client is None:
                self.mongo_client = await init_mongo_client()
                self._owns_mongo = True
            self.database = get_mongo_database()

        if self.analytics_service is None:
            self.analytics_service = AnalyticsService(db=self.database)

        # Ensure collection and index are initialized
        try:
            await self.analytics_service.repository.get_collection()
        except Exception as exc:
            logger.warning("Could not ensure timeseries collection during startup: %s", exc)

        if self.consumer is None:
            self.consumer = AIOKafkaConsumer(
                self.settings.kafka_workout_topic,
                bootstrap_servers=self.settings.kafka_bootstrap_servers,
                group_id=self.settings.kafka_consumer_group,
                enable_auto_commit=True,
                auto_offset_reset="earliest",
            )
            self._owns_consumer = True
            await self.consumer.start()
        elif hasattr(self.consumer, "start"):
            res = self.consumer.start()
            if inspect.isawaitable(res):
                await res

        self._running = True
        logger.info(
            "AnalyticsEventConsumer started on topic '%s' with group '%s'",
            self.settings.kafka_workout_topic,
            self.settings.kafka_consumer_group,
        )

    async def stop(self) -> None:
        """Gracefully stop Kafka consumer and close owned MongoDB connections."""
        self._running = False

        if self.consumer is not None and hasattr(self.consumer, "stop"):
            try:
                res = self.consumer.stop()
                if inspect.isawaitable(res):
                    await res
            except Exception as exc:
                logger.warning("Error stopping Kafka consumer: %s", exc)

        if self._owns_mongo:
            try:
                await close_mongo_client()
            except Exception as exc:
                logger.warning("Error closing MongoDB client: %s", exc)
            self.mongo_client = None

        logger.info("AnalyticsEventConsumer stopped.")

    async def process_message(self, message: Any) -> WorkoutTimeSeriesPoint | None:
        """Process a single Kafka message containing a WorkoutCompletedEvent.

        Validates the payload against WorkoutCompletedEvent schema, computes
        macro-indicators (1RM across 7 formulas + average, tonnage), and stores
        the point in MongoDB Time Series collection.
        """
        raw_value = getattr(message, "value", message)

        try:
            if isinstance(raw_value, (bytes, bytearray)):
                payload_str = raw_value.decode("utf-8")
                event = WorkoutCompletedEvent.model_validate_json(payload_str)
            elif isinstance(raw_value, str):
                event = WorkoutCompletedEvent.model_validate_json(raw_value)
            elif isinstance(raw_value, dict):
                event = WorkoutCompletedEvent.model_validate(raw_value)
            elif isinstance(raw_value, WorkoutCompletedEvent):
                event = raw_value
            else:
                logger.error("Unsupported message payload type: %s", type(raw_value))
                return None
        except (ValidationError, json.JSONDecodeError) as exc:
            logger.error("Validation or JSON error in workout completed event: %s", exc)
            return None
        except Exception as exc:
            logger.error("Unexpected error parsing workout completed event payload: %s", exc)
            return None

        if event.event_type != "workout.completed":
            logger.warning("Ignoring event with unexpected event_type: %s", event.event_type)
            return None

        if self.analytics_service is None:
            if self.database is None:
                self.database = get_mongo_database()
            self.analytics_service = AnalyticsService(db=self.database)

        try:
            point = await self.analytics_service.process_workout_completed_event(event)
            return point
        except Exception as exc:
            logger.error("Error processing analytics for workout %s: %s", event.workout_id, exc)
            return None

    async def consume(self, stop_event: asyncio.Event | None = None) -> None:
        """Continuously consume workout events until stop_event is set or consumer stopped.

        If stop_event is None, runs a single polling pass and terminates cleanly.
        """
        if self.consumer is None:
            raise RuntimeError("Kafka consumer is not initialized or started.")

        if stop_event is None:
            try:
                if hasattr(self.consumer, "getmany"):
                    records = await self.consumer.getmany(timeout_ms=100, max_records=10)
                    for _tp, msgs in records.items():
                        for msg in msgs:
                            await self.process_message(msg)
                elif hasattr(self.consumer, "getone"):
                    try:
                        msg = await asyncio.wait_for(self.consumer.getone(), timeout=0.1)
                        await self.process_message(msg)
                    except TimeoutError:
                        pass
            except Exception as exc:
                logger.error("Error during single pass consume: %s", exc)
            return

        while self._running and not stop_event.is_set():
            try:
                if hasattr(self.consumer, "getmany"):
                    records = await self.consumer.getmany(timeout_ms=300, max_records=50)
                    if not records:
                        await asyncio.sleep(0.01)
                    else:
                        for _tp, msgs in records.items():
                            for msg in msgs:
                                await self.process_message(msg)
                elif hasattr(self.consumer, "getone"):
                    try:
                        msg = await asyncio.wait_for(self.consumer.getone(), timeout=0.3)
                        await self.process_message(msg)
                    except TimeoutError:
                        pass
                else:
                    await asyncio.sleep(0.05)
            except asyncio.CancelledError:
                logger.info("AnalyticsEventConsumer task cancelled.")
                break
            except Exception as exc:
                logger.error("Error in AnalyticsEventConsumer consumption loop: %s", exc)
                await asyncio.sleep(0.1)

    # Loop aliases
    run = consume
    run_loop = consume


__all__ = ["AnalyticsEventConsumer"]
