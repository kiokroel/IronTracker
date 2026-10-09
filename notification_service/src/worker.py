from __future__ import annotations

import asyncio
import logging
import signal
from typing import Any

from notification_service.src.services.consumer import NotificationCommandConsumer
from notification_service.src.services.dispatcher import NotificationDispatcher

logger = logging.getLogger(__name__)


def get_service_status() -> dict[str, str]:
    """Return health status of the notification worker service."""
    return {"status": "ok", "service": "notification"}


def _setup_signal_handlers(stop_event: asyncio.Event) -> None:
    """Register termination signal handlers for graceful shutdown."""
    loop = asyncio.get_running_loop()

    def _handle_signal() -> None:
        logger.info("Termination signal received, stopping notification worker...")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_signal)
        except (NotImplementedError, AttributeError):
            try:
                signal.signal(sig, lambda _sig, _frame: loop.call_soon_threadsafe(stop_event.set))
            except (ValueError, OSError):
                pass


async def consume_messages(
    stop_event: asyncio.Event | None = None,
    consumer: NotificationCommandConsumer | Any | None = None,
) -> None:
    """Consume RabbitMQ notification commands until stop_event is signaled."""
    logger.info("Starting notification command consumer...")

    if consumer is not None:
        try:
            await consumer.start()
            if stop_event is None:
                logger.info("Single pass execution completed for notification worker.")
                return
            await consumer.consume(stop_event)
        except asyncio.CancelledError:
            logger.info("Notification consumer task cancelled.")
        finally:
            logger.info("Notification command consumer stopped gracefully.")
        return

    if stop_event is None:
        logger.info("Single pass execution completed for notification worker.")
        return

    while not stop_event.is_set():
        try:
            await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            logger.info("Notification consumer task cancelled.")
            break

    logger.info("Notification command consumer stopped gracefully.")


async def consume_events(stop_event: asyncio.Event | None = None) -> None:
    """Compatibility alias for consumer execution."""
    await consume_messages(stop_event=stop_event)


async def run_worker(
    stop_event: asyncio.Event | None = None,
    consumer: NotificationCommandConsumer | Any | None = None,
    dispatcher: NotificationDispatcher | None = None,
) -> None:
    """Entrypoint to run the notification worker with graceful shutdown signal handling."""
    if stop_event is None:
        await consume_messages(stop_event=None, consumer=consumer)
        return

    _setup_signal_handlers(stop_event)
    logger.info("Running IronTracker notification worker...")
    active_dispatcher = dispatcher or NotificationDispatcher()
    active_consumer = consumer or NotificationCommandConsumer(dispatcher=active_dispatcher)
    try:
        await consume_messages(stop_event=stop_event, consumer=active_consumer)
    finally:
        logger.info("Notification worker stopped.")


def main() -> None:
    """CLI entrypoint for running notification worker."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    stop_event = asyncio.Event()
    dispatcher = NotificationDispatcher()
    consumer = NotificationCommandConsumer(dispatcher=dispatcher)
    try:
        asyncio.run(run_worker(stop_event=stop_event, consumer=consumer))
    except (KeyboardInterrupt, SystemExit):
        logger.info("Notification worker stopped by interrupt.")


if __name__ == "__main__":
    main()
