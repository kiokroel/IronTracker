from __future__ import annotations

import asyncio
import inspect
import json
import logging
from typing import Any

from aiokafka import AIOKafkaConsumer
from pydantic import ValidationError
from redis.asyncio import Redis

from leaderboard_service.src.core.config import Settings, get_settings
from leaderboard_service.src.core.redis import get_redis_client
from leaderboard_service.src.services.tonnage import (
    calculate_workout_tonnage,
    update_user_tonnage,
)
from shared.contracts.src.events import WorkoutCompletedEvent, WorkoutCreatedEvent

logger = logging.getLogger(__name__)


class WorkoutEventConsumer:
    """Kafka consumer that listens for workout events and updates leaderboards in Redis."""

    def __init__(
        self,
        settings: Settings | None = None,
        consumer: AIOKafkaConsumer | None = None,
        redis: Redis | None = None,
    ) -> None:
        self.settings: Settings = settings or get_settings()
        self.consumer: AIOKafkaConsumer | None = consumer
        self._owns_consumer: bool = consumer is None
        self.redis: Redis | None = redis
        self._owns_redis: bool = redis is None
        self._running: bool = False

    async def start(self) -> None:
        """Initialize and start Kafka consumer and Redis connections."""
        if self.redis is None:
            self.redis = get_redis_client()
            self._owns_redis = True

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
            "WorkoutEventConsumer started on topic '%s' with group '%s'",
            self.settings.kafka_workout_topic,
            self.settings.kafka_consumer_group,
        )

    async def stop(self) -> None:
        """Gracefully stop Kafka consumer and close owned Redis connections."""
        self._running = False

        if self.consumer is not None and hasattr(self.consumer, "stop"):
            try:
                res = self.consumer.stop()
                if inspect.isawaitable(res):
                    await res
            except Exception as exc:
                logger.warning("Error stopping Kafka consumer: %s", exc)

        if self._owns_redis and self.redis is not None:
            try:
                await self.redis.aclose()
            except Exception as exc:
                logger.warning("Error closing Redis client: %s", exc)
            self.redis = None

        logger.info("WorkoutEventConsumer stopped.")

    async def process_message(self, message: Any) -> float | None:
        """Process a single Kafka message containing a WorkoutCompletedEvent.

        Extracts payload, validates WorkoutCompletedEvent schema,
        computes workout tonnage, and updates user score in Redis ZSET.
        Returns the updated user tonnage, or None if message was invalid or ignored.
        """
        raw_value = getattr(message, "value", message)
        event: WorkoutCompletedEvent | WorkoutCreatedEvent

        try:
            if isinstance(raw_value, (bytes, bytearray)):
                payload_str = raw_value.decode("utf-8")
                try:
                    event = WorkoutCompletedEvent.model_validate_json(payload_str)
                except ValidationError:
                    event = WorkoutCreatedEvent.model_validate_json(payload_str)
            elif isinstance(raw_value, str):
                try:
                    event = WorkoutCompletedEvent.model_validate_json(raw_value)
                except ValidationError:
                    event = WorkoutCreatedEvent.model_validate_json(raw_value)
            elif isinstance(raw_value, dict):
                try:
                    event = WorkoutCompletedEvent.model_validate(raw_value)
                except ValidationError:
                    event = WorkoutCreatedEvent.model_validate(raw_value)
            elif isinstance(raw_value, (WorkoutCompletedEvent, WorkoutCreatedEvent)):
                event = raw_value
            else:
                logger.error("Unsupported message payload type: %s", type(raw_value))
                return None
        except (ValidationError, json.JSONDecodeError) as exc:
            logger.error("Schema validation or JSON decode error in workout event: %s", exc)
            return None
        except Exception as exc:
            logger.error("Unexpected error parsing workout event payload: %s", exc)
            return None

        if event.event_type not in ("workout.completed", "workout.created"):
            logger.warning("Ignoring event with unexpected event_type: %s", event.event_type)
            return None

        try:
            tonnage = calculate_workout_tonnage(event.metrics)
        except Exception as exc:
            logger.error(
                "Error calculating tonnage for workout %s: %s",
                event.workout_id,
                exc,
            )
            return None

        if self.redis is None:
            raise RuntimeError("Redis client is not initialized in WorkoutEventConsumer.")

        try:
            new_score = await update_user_tonnage(
                redis=self.redis,
                user_id=event.user_id,
                tonnage=tonnage,
                leaderboard_key=self.settings.leaderboard_tonnage_key,
            )
            logger.info(
                "Updated tonnage for user %s: added=%.2f kg, total=%.2f kg (workout %s)",
                event.user_id,
                tonnage,
                new_score,
                event.workout_id,
            )
            return new_score
        except Exception as exc:
            logger.error(
                "Error updating user tonnage in Redis for user %s: %s",
                event.user_id,
                exc,
            )
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
                logger.info("WorkoutEventConsumer task cancelled.")
                break
            except Exception as exc:
                logger.error("Error in WorkoutEventConsumer consumption loop: %s", exc)
                await asyncio.sleep(0.1)

    # Aliases for consumer execution loop
    run = consume
    run_loop = consume


__all__ = ["WorkoutEventConsumer"]
