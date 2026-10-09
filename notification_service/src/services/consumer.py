from __future__ import annotations

import asyncio
import inspect
import json
import logging
from typing import Any

from aio_pika.abc import (
    AbstractIncomingMessage,
    AbstractQueue,
    AbstractRobustChannel,
    AbstractRobustConnection,
)

from notification_service.src.core.config import Settings, get_settings
from notification_service.src.core.rabbitmq import (
    close_rabbitmq,
    declare_queue_topology,
    get_rabbitmq_connection,
)
from notification_service.src.schemas.dispatch import NotificationDispatchResult
from notification_service.src.services.dispatcher import (
    NotificationDispatcher,
)
from shared.contracts.src.commands import (
    SendAchievementNotificationCommand,
    SendNotificationCommand,
)

logger = logging.getLogger(__name__)


class NotificationCommandConsumer:
    """RabbitMQ consumer that processes notification commands with Dead Letter Exchange retry."""

    def __init__(
        self,
        settings: Settings | None = None,
        connection: AbstractRobustConnection | None = None,
        channel: AbstractRobustChannel | None = None,
        dispatcher: NotificationDispatcher | None = None,
    ) -> None:
        self.settings: Settings = settings or get_settings()
        self.connection: AbstractRobustConnection | None = connection
        self._owns_connection: bool = connection is None
        self.channel: AbstractRobustChannel | None = channel
        self._owns_channel: bool = channel is None
        self.dispatcher: NotificationDispatcher = dispatcher or NotificationDispatcher()
        self.queue: AbstractQueue | None = None
        self._running: bool = False

    @property
    def is_running(self) -> bool:
        """Return True if consumer is active."""
        return self._running

    async def start(self) -> None:
        """Initialize connection, channel, and declare queue topology."""
        if self._running and self.queue is not None:
            return

        if self.connection is None:
            self.connection = await get_rabbitmq_connection()

        if self.channel is None:
            chan = self.connection.channel()
            try:
                self.channel = await chan
            except TypeError:
                self.channel = chan

        topology = await declare_queue_topology(self.channel)
        self.queue = topology["queue"]
        self._running = True

        logger.info(
            "NotificationCommandConsumer started on queue '%s'",
            self.settings.rabbitmq_queue,
        )

    async def stop(self) -> None:
        """Gracefully stop the consumer and release owned resources."""
        self._running = False

        if self._owns_channel and self.channel is not None and not self.channel.is_closed:
            try:
                await self.channel.close()
            except Exception as exc:
                logger.warning("Error closing RabbitMQ channel: %s", exc)
            self.channel = None

        if self._owns_connection and self.connection is not None and not self.connection.is_closed:
            try:
                await close_rabbitmq()
            except Exception as exc:
                logger.warning("Error closing RabbitMQ connection: %s", exc)
            self.connection = None

        self.queue = None
        logger.info("NotificationCommandConsumer stopped gracefully.")

    async def process_message(
        self,
        message: AbstractIncomingMessage | Any,
    ) -> NotificationDispatchResult | None:
        """Process an incoming RabbitMQ command message.

        Acknowledge message on successful validation and dispatch.
        Send to Dead Letter Exchange (DLX) via nack(requeue=False) on any error.
        """
        try:
            raw_body = getattr(message, "body", None)
            if raw_body is None:
                raw_body = getattr(message, "value", message)
            if isinstance(raw_body, (bytes, bytearray)):
                payload_str = raw_body.decode("utf-8")
                data = json.loads(payload_str)
            elif isinstance(raw_body, str):
                data = json.loads(raw_body)
            elif isinstance(raw_body, dict):
                data = raw_body
            else:
                raise ValueError(f"Invalid message payload format: {type(raw_body)}")

            command_type = data.get("command_type")
            command: SendNotificationCommand | SendAchievementNotificationCommand
            if command_type == "notification.send":
                command = SendNotificationCommand.model_validate(data)
            elif command_type == "notification.achievement":
                command = SendAchievementNotificationCommand.model_validate(data)
            else:
                raise ValueError(f"Unsupported command type: {command_type}")

            logger.info("Dispatching command %s for user %s", command.command_type, command.user_id)
            result = await self.dispatcher.dispatch(command)

            if hasattr(message, "ack"):
                ack_res = message.ack()
                if inspect.isawaitable(ack_res):
                    await ack_res

            return result

        except Exception as exc:
            logger.error("Failed to process message: %s. Rejecting to DLX.", exc)
            if hasattr(message, "nack"):
                nack_res = message.nack(requeue=False)
                if inspect.isawaitable(nack_res):
                    await nack_res
            return None

    async def consume(self, stop_event: asyncio.Event | None = None) -> None:
        """Continuously consume messages from the queue until stop_event is set."""
        if not self._running or self.queue is None:
            await self.start()

        if self.queue is None:
            raise RuntimeError("Queue topology not initialized")

        async with self.queue.iterator() as queue_iter:
            async for message in queue_iter:
                await self.process_message(message)
                if stop_event is not None and stop_event.is_set():
                    break


__all__ = [
    "NotificationCommandConsumer",
]
