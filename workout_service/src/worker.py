from __future__ import annotations

import asyncio
import logging
import signal
from typing import Any

from workout_service.src.services.outbox_processor import OutboxProcessor

logger = logging.getLogger(__name__)


def get_service_status() -> dict[str, str]:
    """Return health and service status information."""
    return {"status": "ok", "service": "workout_outbox_worker"}


async def run_worker(
    stop_event: asyncio.Event | None = None,
    processor: OutboxProcessor | None = None,
) -> None:
    """Run outbox relay worker lifecycle."""
    proc = processor or OutboxProcessor()
    logger.info("Starting OutboxProcessor...")
    await proc.start()
    try:
        await proc.run_loop(stop_event=stop_event)
    finally:
        logger.info("Stopping OutboxProcessor...")
        await proc.stop()


def main() -> None:
    """Run outbox worker process with graceful shutdown signal handlers."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    stop_event = asyncio.Event()

    def _shutdown_handler(sig: int, frame: Any) -> None:
        logger.info("Signal %s received, shutting down gracefully...", sig)
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, _shutdown_handler)
        except (ValueError, AttributeError):
            pass

    try:
        asyncio.run(run_worker(stop_event=stop_event))
    except (KeyboardInterrupt, SystemExit):
        logger.info("Worker process exited cleanly.")


if __name__ == "__main__":
    main()
