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
from notification_service.src.schemas.dispatch import (
    NotificationDispatchResult,
)
from notification_service.src.schemas.health import (
    HealthResponse,
    QueueTopologyResponse,
)
from notification_service.src.services.consumer import (
    NotificationCommandConsumer,
)
from notification_service.src.services.dispatcher import (
    NotificationDispatcher,
    NotificationProviderError,
)
from notification_service.src.services.retry import DLQRetryProcessor
from notification_service.src.worker import (
    consume_events,
    consume_messages,
    get_service_status,
    run_worker,
)

__all__ = [
    "DLQRetryProcessor",
    "HealthResponse",
    "NotificationCommandConsumer",
    "NotificationDispatchResult",
    "NotificationDispatcher",
    "NotificationProviderError",
    "QueueTopologyResponse",
    "RabbitMQSettings",
    "Settings",
    "close_rabbitmq",
    "consume_events",
    "consume_messages",
    "declare_queue_topology",
    "get_rabbitmq_channel",
    "get_rabbitmq_connection",
    "get_service_status",
    "get_settings",
    "init_rabbitmq",
    "run_worker",
    "settings",
]
