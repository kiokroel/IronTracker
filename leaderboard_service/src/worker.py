from __future__ import annotations

import asyncio
import logging
import signal
from typing import Any

from leaderboard_service.src.services.consumer import WorkoutEventConsumer

logger = logging.getLogger(__name__)


def get_service_status() -> dict[str, str]:
    """Return health and service status information for the consumer worker."""
    return {"status": "ok", "service": "leaderboard_consumer_worker"}


async def run_worker(
    stop_event: asyncio.Event | None = None,
    consumer: WorkoutEventConsumer | None = None,
) -> None:
    """Run leaderboard Kafka consumer worker lifecycle."""
    cons = consumer or WorkoutEventConsumer()
    logger.info("Starting Leaderboard WorkoutEventConsumer worker...")
    await cons.start()
    try:
        await cons.consume(stop_event=stop_event)
    finally:
        logger.info("Stopping Leaderboard WorkoutEventConsumer worker...")
        await cons.stop()


def main() -> None:
    """Run leaderboard consumer worker with graceful shutdown signal handlers."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    stop_event = asyncio.Event()

    def _shutdown_handler(sig: int, frame: Any) -> None:
        logger.info("Shutdown signal %s received, stopping worker gracefully...", sig)
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, _shutdown_handler)
        except (ValueError, AttributeError):
            pass

    try:
        asyncio.run(run_worker(stop_event=stop_event))
    except (KeyboardInterrupt, SystemExit):
        logger.info("Leaderboard consumer worker process exited cleanly.")


if __name__ == "__main__":
    main()
