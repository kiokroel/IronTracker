from __future__ import annotations

from notification_service.src.core.config import (
    RabbitMQSettings,
    Settings,
    get_settings,
    settings,
)
from notification_service.src.core.rabbitmq import (
    close_rabbitmq,
    declare_queue_topology,
    get_rabbitmq_channel,
    get_rabbitmq_connection,
    init_rabbitmq,
)

__all__ = [
    "RabbitMQSettings",
    "Settings",
    "close_rabbitmq",
    "declare_queue_topology",
    "get_rabbitmq_channel",
    "get_rabbitmq_connection",
    "get_settings",
    "init_rabbitmq",
    "settings",
]
