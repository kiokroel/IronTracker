from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime

from aiokafka import AIOKafkaProducer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from workout_service.src.core.config import Settings, get_settings
from workout_service.src.core.database import async_session_factory
from workout_service.src.models.outbox import OutboxModel

logger = logging.getLogger(__name__)


class OutboxProcessor:
    """Outbox relay processor reading pending events and publishing to Kafka."""

    def __init__(
        self,
        settings: Settings | None = None,
        producer: AIOKafkaProducer | None = None,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
    ) -> None:
        self.settings: Settings = settings or get_settings()
        self.producer: AIOKafkaProducer | None = producer
        self._owns_producer: bool = producer is None
        self.session_factory: async_sessionmaker[AsyncSession] = (
            session_factory or async_session_factory
        )
        self.topic: str = self.settings.kafka_workout_topic
        self.batch_size: int = self.settings.outbox_batch_size
        self.poll_interval: float = self.settings.outbox_poll_interval
        self.max_retries: int = self.settings.outbox_max_retries

    async def start(self) -> None:
        """Initialize and start Kafka producer if not injected externally."""
        if self.producer is None:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.settings.kafka_bootstrap_servers
            )
            await self.producer.start()

    async def stop(self) -> None:
        """Stop Kafka producer."""
        if self.producer is not None:
            await self.producer.stop()

    async def process_batch(self, session: AsyncSession) -> int:
        """Fetch pending outbox records with skip_locked and publish to Kafka."""
        stmt = (
            select(OutboxModel)
            .where(OutboxModel.status == "pending")
            .order_by(OutboxModel.created_at.asc())
            .limit(self.batch_size)
            .with_for_update(skip_locked=True)
        )
        result = await session.execute(stmt)
        entries = list(result.scalars().all())

        if not entries:
            return 0

        for entry in entries:
            key = str(entry.id).encode("utf-8")
            value = json.dumps(entry.payload, default=str).encode("utf-8")
            try:
                if self.producer is None:
                    raise RuntimeError("Kafka producer is not initialized or started.")
                await self.producer.send_and_wait(self.topic, value=value, key=key)
                entry.status = "processed"
                entry.processed_at = datetime.now(UTC)
            except Exception as exc:
                logger.warning(
                    "Error publishing outbox event %s (retry %s): %s",
                    entry.id,
                    entry.retry_count,
                    exc,
                )
                entry.retry_count += 1
                if entry.retry_count >= self.max_retries:
                    entry.status = "failed"

        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        return len(entries)

    async def run_loop(self, stop_event: asyncio.Event | None = None) -> None:
        """Run batch processing loop or execute a single pass if stop_event is None."""
        if stop_event is None:
            async with self.session_factory() as session:
                await self.process_batch(session)
            return

        while not stop_event.is_set():
            try:
                async with self.session_factory() as session:
                    await self.process_batch(session)
            except Exception as exc:
                logger.error("Error processing outbox batch in loop: %s", exc)

            try:
                await asyncio.wait_for(stop_event.wait(), timeout=self.poll_interval)
            except TimeoutError:
                pass
