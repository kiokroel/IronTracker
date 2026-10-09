from __future__ import annotations

import asyncio
import logging
import signal
from typing import Any

from analytics_service.src.core.config import get_settings
from analytics_service.src.core.database import (
    close_mongo_client,
    ensure_timeseries_collection,
    init_mongo_client,
)
from analytics_service.src.services.consumer import AnalyticsEventConsumer

logger = logging.getLogger(__name__)


def get_service_status() -> dict[str, str]:
    """Return health status of the analytics worker service."""
    return {"status": "ok", "service": "analytics"}


async def consume_events(
    stop_event: asyncio.Event | None = None,
    consumer: AnalyticsEventConsumer | None = None,
    handler: Any | None = None,
) -> None:
    """Async consumer loop for processing Kafka analytics events.

    In production, this consumer reads workout events from Kafka topics
    and aggregates macro metrics into MongoDB Time Series collections.
    """
    logger.info("Starting analytics event consumer loop...")

    if consumer is not None:
        await consumer.consume(stop_event=stop_event)
        return

    if stop_event is None:
        logger.info("Single pass execution completed for analytics worker.")
        return

    while not stop_event.is_set():
        try:
            # Poll / process events placeholder
            await asyncio.sleep(0.05)
        except asyncio.CancelledError:
            logger.info("Analytics consumer task cancelled.")
            break

    logger.info("Analytics event consumer stopped gracefully.")


async def run_worker(
    stop_event: asyncio.Event | None = None,
    consumer: AnalyticsEventConsumer | None = None,
) -> None:
    """Entrypoint to run the analytics worker with MongoDB lifecycle management."""
    logger.info("Initializing analytics worker and MongoDB connection...")
    await init_mongo_client()
    try:
        await ensure_timeseries_collection()
    except Exception as exc:
        logger.warning("Could not ensure timeseries collection during worker startup: %s", exc)

    settings = get_settings()
    event_consumer = consumer
    owns_consumer = False

    # Start Kafka consumer if provided or enabled in configuration
    if event_consumer is None and settings.enable_kafka_consumer:
        event_consumer = AnalyticsEventConsumer()
        owns_consumer = True

    try:
        if owns_consumer and event_consumer is not None:
            await event_consumer.start()
        await consume_events(stop_event=stop_event, consumer=event_consumer)
    finally:
        if owns_consumer and event_consumer is not None:
            try:
                await event_consumer.stop()
            except Exception as exc:
                logger.warning("Error stopping analytics consumer in worker: %s", exc)
        logger.info("Stopping analytics worker and closing MongoDB client...")
        await close_mongo_client()


def main() -> None:
    """Run analytics worker with graceful shutdown signal handlers."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    stop_event = asyncio.Event()

    def _shutdown_handler(sig: int, frame: Any) -> None:
        logger.info("Shutdown signal %s received, stopping analytics worker gracefully...", sig)
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, _shutdown_handler)
        except (ValueError, AttributeError):
            pass

    try:
        asyncio.run(run_worker(stop_event=stop_event))
    except (KeyboardInterrupt, SystemExit):
        logger.info("Analytics worker process exited cleanly.")


if __name__ == "__main__":
    main()
