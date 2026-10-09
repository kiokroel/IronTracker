from __future__ import annotations

import logging
from typing import Any

import aio_pika
from aio_pika.abc import AbstractRobustChannel, AbstractRobustConnection

from notification_service.src.core.config import get_settings

logger = logging.getLogger(__name__)

_connection: AbstractRobustConnection | None = None


async def get_rabbitmq_connection() -> AbstractRobustConnection:
    """Get or establish the singleton robust RabbitMQ connection."""
    global _connection
    if _connection is None or _connection.is_closed:
        _connection = await init_rabbitmq()
    return _connection


async def init_rabbitmq(url: str | None = None) -> AbstractRobustConnection:
    """Initialize and return a robust RabbitMQ connection."""
    global _connection
    settings = get_settings()
    connection_url = url or settings.amqp_url
    logger.info("Connecting to RabbitMQ at %s", connection_url)
    _connection = await aio_pika.connect_robust(connection_url)
    return _connection


async def close_rabbitmq() -> None:
    """Close the active RabbitMQ connection gracefully."""
    global _connection
    if _connection is not None and not _connection.is_closed:
        logger.info("Closing RabbitMQ connection...")
        await _connection.close()
        _connection = None


async def get_rabbitmq_channel() -> AbstractRobustChannel:
    """Acquire a channel from the current RabbitMQ connection."""
    conn = await get_rabbitmq_connection()
    chan = conn.channel()
    try:
        return await chan
    except TypeError:
        return chan


async def declare_queue_topology(channel: AbstractRobustChannel) -> dict[str, Any]:
    """Declare DLX, DLQ, main Exchange, and main Queue with DLX bindings."""
    settings = get_settings()

    # 1. Declare Dead Letter Exchange (DLX)
    dlx = await channel.declare_exchange(
        settings.rabbitmq_dlx_exchange,
        aio_pika.ExchangeType.DIRECT,
        durable=True,
    )

    # 2. Declare Dead Letter Queue (DLQ) and bind to DLX
    dlq = await channel.declare_queue(
        settings.rabbitmq_dlq_queue,
        durable=True,
    )
    await dlq.bind(dlx, routing_key=settings.rabbitmq_dlx_routing_key)

    # 3. Declare Main Exchange
    main_exchange = await channel.declare_exchange(
        settings.rabbitmq_exchange,
        aio_pika.ExchangeType.DIRECT,
        durable=True,
    )

    # 4. Declare Main Queue with Dead Letter routing arguments
    main_queue = await channel.declare_queue(
        settings.rabbitmq_queue,
        durable=True,
        arguments={
            "x-dead-letter-exchange": settings.rabbitmq_dlx_exchange,
            "x-dead-letter-routing-key": settings.rabbitmq_dlx_routing_key,
        },
    )
    await main_queue.bind(main_exchange, routing_key=settings.rabbitmq_routing_key)

    return {
        "dlx": dlx,
        "dlq": dlq,
        "exchange": main_exchange,
        "queue": main_queue,
    }


__all__ = [
    "close_rabbitmq",
    "declare_queue_topology",
    "get_rabbitmq_channel",
    "get_rabbitmq_connection",
    "init_rabbitmq",
]
