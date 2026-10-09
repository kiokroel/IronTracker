from __future__ import annotations

import inspect
import logging
from typing import Any

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustChannel

from notification_service.src.core.config import Settings, get_settings
from notification_service.src.core.rabbitmq import get_rabbitmq_channel

logger = logging.getLogger(__name__)


class DLQRetryProcessor:
    """Processor for recovering and republishing unhandled messages from the Dead Letter Queue."""

    def __init__(
        self,
        max_retries: int = 3,
        channel: AbstractRobustChannel | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.max_retries = max(1, max_retries)
        self.channel = channel
        self.settings: Settings = settings or get_settings()

    def extract_retry_count(self, headers: dict[str, Any] | None) -> int:
        """Extract the current retry attempt count from message headers or x-death metadata."""
        if not headers:
            return 0

        if "x-retry-count" in headers:
            try:
                return int(headers["x-retry-count"])
            except (ValueError, TypeError):
                pass

        if "x-death" in headers:
            x_death = headers["x-death"]
            if isinstance(x_death, list) and len(x_death) > 0:
                first_death = x_death[0]
                if isinstance(first_death, dict) and "count" in first_death:
                    try:
                        return int(first_death["count"])
                    except (ValueError, TypeError):
                        pass

        return 0

    def should_retry(self, headers: dict[str, Any] | None, current_retry: int) -> bool:
        """Determine whether the message is eligible for another processing attempt."""
        return current_retry < self.max_retries

    async def process_dlq_message(
        self,
        message: AbstractIncomingMessage | Any,
        channel: AbstractRobustChannel | None = None,
    ) -> bool:
        """Evaluate DLQ message retry counter, republish to main exchange or finalize as dead."""
        active_channel = channel or self.channel
        if active_channel is None:
            active_channel = await get_rabbitmq_channel()

        raw_headers = getattr(message, "headers", None) or {}
        headers_dict: dict[str, Any] = dict(raw_headers) if raw_headers else {}
        current_retry = self.extract_retry_count(headers_dict)

        if self.should_retry(headers_dict, current_retry):
            new_retry_count = current_retry + 1
            updated_headers = dict(headers_dict)
            updated_headers["x-retry-count"] = new_retry_count

            republish_msg = aio_pika.Message(
                body=message.body,
                headers=updated_headers,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                content_type=getattr(message, "content_type", "application/json"),
            )

            exchange_res = active_channel.get_exchange(
                self.settings.rabbitmq_exchange,
                ensure=False,
            )
            exchange = await exchange_res if inspect.isawaitable(exchange_res) else exchange_res

            pub_res = exchange.publish(
                republish_msg,
                routing_key=self.settings.rabbitmq_routing_key,
            )
            if inspect.isawaitable(pub_res):
                await pub_res

            logger.info(
                "Republished DLQ message to exchange '%s' (retry %d/%d)",
                self.settings.rabbitmq_exchange,
                new_retry_count,
                self.max_retries,
            )

            if hasattr(message, "ack"):
                ack_res = message.ack()
                if inspect.isawaitable(ack_res):
                    await ack_res

            return True

        logger.warning(
            "Max retries (%d) reached for DLQ message. Acknowledging as permanent failure.",
            self.max_retries,
        )
        if hasattr(message, "ack"):
            ack_res = message.ack()
            if inspect.isawaitable(ack_res):
                await ack_res

        return False


__all__ = [
    "DLQRetryProcessor",
]
