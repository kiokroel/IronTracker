from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import aio_pika
import pytest

from notification_service.src import (
    HealthResponse,
    NotificationCommandConsumer,
    QueueTopologyResponse,
    RabbitMQSettings,
    Settings,
    close_rabbitmq,
    consume_events,
    consume_messages,
    declare_queue_topology,
    get_rabbitmq_channel,
    get_rabbitmq_connection,
    get_service_status,
    get_settings,
    init_rabbitmq,
    run_worker,
)
from shared.contracts.src.commands import (
    SendAchievementNotificationCommand,
    SendNotificationCommand,
)

# ==============================================================================
# 1. Configuration and URL Generator Tests
# ==============================================================================


def test_rabbitmq_settings_defaults() -> None:
    """Verify default values in RabbitMQSettings."""
    cfg = RabbitMQSettings()
    assert cfg.rabbitmq_host == "localhost"
    assert cfg.rabbitmq_port == 5672
    assert cfg.rabbitmq_user == "irontracker"
    assert cfg.rabbitmq_password == "irontracker_rabbit_secret"
    assert cfg.rabbitmq_vhost == "/"
    assert cfg.rabbitmq_queue == "notifications_queue"
    assert cfg.rabbitmq_exchange == "notifications_exchange"
    assert cfg.rabbitmq_routing_key == "notification.dispatch"
    assert cfg.rabbitmq_dlx_exchange == "notifications_dlx"
    assert cfg.rabbitmq_dlq_queue == "notifications_dlq"
    assert cfg.rabbitmq_dlx_routing_key == "notification.dead_letter"
    assert cfg.amqp_url == "amqp://irontracker:irontracker_rabbit_secret@localhost:5672/"


def test_rabbitmq_uppercase_properties() -> None:
    """Verify uppercase property accessors."""
    cfg = RabbitMQSettings()
    assert cfg.RABBITMQ_HOST == "localhost"
    assert cfg.RABBITMQ_PORT == 5672
    assert cfg.RABBITMQ_USER == "irontracker"
    assert cfg.RABBITMQ_PASSWORD == "irontracker_rabbit_secret"
    assert cfg.RABBITMQ_VHOST == "/"
    assert cfg.RABBITMQ_QUEUE == "notifications_queue"
    assert cfg.RABBITMQ_EXCHANGE == "notifications_exchange"
    assert cfg.RABBITMQ_ROUTING_KEY == "notification.dispatch"
    assert cfg.RABBITMQ_DLX_EXCHANGE == "notifications_dlx"
    assert cfg.RABBITMQ_DLQ_QUEUE == "notifications_dlq"
    assert cfg.RABBITMQ_DLX_ROUTING_KEY == "notification.dead_letter"
    assert cfg.AMQP_URL == cfg.amqp_url


def test_settings_submodel_and_properties() -> None:
    """Verify global Settings properties and rabbitmq submodel extraction."""
    s = Settings(
        app_name="Custom Notification Service",
        debug=True,
        rabbitmq_host="rabbit.internal",
        rabbitmq_port=5673,
    )
    assert s.app_name == "Custom Notification Service"
    assert s.APP_NAME == "Custom Notification Service"
    assert s.debug is True
    assert s.DEBUG is True
    assert s.rabbitmq_host == "rabbit.internal"
    assert s.rabbitmq_port == 5673
    assert s.amqp_url == "amqp://irontracker:irontracker_rabbit_secret@rabbit.internal:5673/"

    rabbit_sub = s.rabbitmq
    assert isinstance(rabbit_sub, RabbitMQSettings)
    assert rabbit_sub.rabbitmq_host == "rabbit.internal"
    assert rabbit_sub.rabbitmq_port == 5673


def test_settings_singleton() -> None:
    """Verify get_settings returns consistent settings."""
    s1 = get_settings()
    s2 = get_settings()
    assert s1 is s2


# ==============================================================================
# 2. Schema Validation Tests
# ==============================================================================


def test_health_response_schema() -> None:
    """Verify HealthResponse model serialization and defaults."""
    resp = HealthResponse()
    assert resp.status == "ok"
    assert resp.service == "notification"

    custom = HealthResponse(status="degraded", service="notification-worker")
    assert custom.status == "degraded"
    assert custom.service == "notification-worker"


def test_queue_topology_response_schema() -> None:
    """Verify QueueTopologyResponse model validation."""
    resp = QueueTopologyResponse(
        queue="main_q",
        exchange="main_ex",
        dlx="dlx_ex",
        dlq="dlq_q",
    )
    assert resp.queue == "main_q"
    assert resp.exchange == "main_ex"
    assert resp.dlx == "dlx_ex"
    assert resp.dlq == "dlq_q"


# ==============================================================================
# 3. RabbitMQ Topology Declaration Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_declare_queue_topology() -> None:
    """Verify declare_queue_topology configures DLX, DLQ, main Exchange, and Queue."""
    channel_mock = AsyncMock(spec=aio_pika.abc.AbstractRobustChannel)
    dlx_mock = AsyncMock()
    dlq_mock = AsyncMock()
    main_exchange_mock = AsyncMock()
    main_queue_mock = AsyncMock()

    channel_mock.declare_exchange.side_effect = [dlx_mock, main_exchange_mock]
    channel_mock.declare_queue.side_effect = [dlq_mock, main_queue_mock]

    topology = await declare_queue_topology(channel_mock)

    assert topology["dlx"] == dlx_mock
    assert topology["dlq"] == dlq_mock
    assert topology["exchange"] == main_exchange_mock
    assert topology["queue"] == main_queue_mock

    # Check DLX exchange declaration
    channel_mock.declare_exchange.assert_any_call(
        "notifications_dlx",
        aio_pika.ExchangeType.DIRECT,
        durable=True,
    )

    # Check DLQ declaration and binding
    channel_mock.declare_queue.assert_any_call("notifications_dlq", durable=True)
    dlq_mock.bind.assert_awaited_once_with(dlx_mock, routing_key="notification.dead_letter")

    # Check main exchange declaration
    channel_mock.declare_exchange.assert_any_call(
        "notifications_exchange",
        aio_pika.ExchangeType.DIRECT,
        durable=True,
    )

    # Check main queue declaration with DLX arguments and binding
    channel_mock.declare_queue.assert_any_call(
        "notifications_queue",
        durable=True,
        arguments={
            "x-dead-letter-exchange": "notifications_dlx",
            "x-dead-letter-routing-key": "notification.dead_letter",
        },
    )
    main_queue_mock.bind.assert_awaited_once_with(
        main_exchange_mock,
        routing_key="notification.dispatch",
    )


# ==============================================================================
# 4. Connection Lifecycle Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_init_and_close_rabbitmq() -> None:
    """Verify init_rabbitmq connects and close_rabbitmq closes connection."""
    mock_conn = AsyncMock(spec=aio_pika.abc.AbstractRobustConnection)
    mock_conn.is_closed = False

    with patch("aio_pika.connect_robust", new_callable=AsyncMock) as mock_connect:
        mock_connect.return_value = mock_conn

        conn = await init_rabbitmq("amqp://custom-host:5672/")
        assert conn is mock_conn
        mock_connect.assert_awaited_once_with("amqp://custom-host:5672/")

        # Verify get_rabbitmq_connection returns cached connection
        same_conn = await get_rabbitmq_connection()
        assert same_conn is mock_conn

        # Close connection
        await close_rabbitmq()
        mock_conn.close.assert_awaited_once()

        # Closing already closed or None is safe
        await close_rabbitmq()


@pytest.mark.asyncio
async def test_get_rabbitmq_channel() -> None:
    """Verify get_rabbitmq_channel retrieves a channel from the connection."""
    mock_conn = AsyncMock(spec=aio_pika.abc.AbstractRobustConnection)
    mock_conn.is_closed = False
    mock_chan = AsyncMock(spec=aio_pika.abc.AbstractRobustChannel)
    mock_conn.channel.return_value = mock_chan

    with patch(
        "notification_service.src.core.rabbitmq.get_rabbitmq_connection",
        new_callable=AsyncMock,
    ) as mock_get_conn:
        mock_get_conn.return_value = mock_conn
        chan = await get_rabbitmq_channel()
        assert chan is mock_chan
        mock_conn.channel.assert_called_once()


# ==============================================================================
# 5. Consumer Tests (Success & DLX Fallback)
# ==============================================================================


@pytest.mark.asyncio
async def test_consumer_process_send_notification_command_success() -> None:
    """Verify consumer successfully decodes, validates, and acks SendNotificationCommand."""
    consumer = NotificationCommandConsumer()

    user_id = uuid4()
    payload = {
        "command_id": str(uuid4()),
        "command_type": "notification.send",
        "user_id": str(user_id),
        "channel": "email",
        "title": "Workout Logged",
        "message": "Great job on completing your bench press workout!",
    }

    message_mock = AsyncMock()
    message_mock.body = json.dumps(payload).encode("utf-8")

    result = await consumer.process_message(message_mock)

    assert isinstance(result, SendNotificationCommand)
    assert result.user_id == user_id
    assert result.channel == "email"
    assert result.title == "Workout Logged"
    message_mock.ack.assert_awaited_once()
    message_mock.nack.assert_not_called()


@pytest.mark.asyncio
async def test_consumer_process_send_achievement_notification_command_success() -> None:
    """Verify consumer successfully decodes and acks SendAchievementNotificationCommand."""
    consumer = NotificationCommandConsumer()

    user_id = uuid4()
    payload = {
        "command_id": str(uuid4()),
        "command_type": "notification.achievement",
        "user_id": str(user_id),
        "achievement_code": "BENCH_100_KG",
        "title": "Century Club!",
        "message": "You hit 100 kg on Bench Press!",
    }

    message_mock = AsyncMock()
    message_mock.body = json.dumps(payload).encode("utf-8")

    result = await consumer.process_message(message_mock)

    assert isinstance(result, SendAchievementNotificationCommand)
    assert result.user_id == user_id
    assert result.achievement_code == "BENCH_100_KG"
    assert result.title == "Century Club!"
    message_mock.ack.assert_awaited_once()
    message_mock.nack.assert_not_called()


@pytest.mark.asyncio
async def test_consumer_rejects_corrupted_payload_to_dlx() -> None:
    """Verify corrupted JSON payload is rejected without requeue (nack requeue=False -> DLX)."""
    consumer = NotificationCommandConsumer()

    message_mock = AsyncMock()
    message_mock.body = b"not-a-json-payload"

    result = await consumer.process_message(message_mock)

    assert result is None
    message_mock.ack.assert_not_called()
    message_mock.nack.assert_awaited_once_with(requeue=False)


@pytest.mark.asyncio
async def test_consumer_rejects_unknown_command_type_to_dlx() -> None:
    """Verify unknown command_type is rejected without requeue to DLX."""
    consumer = NotificationCommandConsumer()

    payload = {
        "command_id": str(uuid4()),
        "command_type": "notification.unknown_type",
        "user_id": str(uuid4()),
    }
    message_mock = AsyncMock()
    message_mock.body = json.dumps(payload).encode("utf-8")

    result = await consumer.process_message(message_mock)

    assert result is None
    message_mock.ack.assert_not_called()
    message_mock.nack.assert_awaited_once_with(requeue=False)


@pytest.mark.asyncio
async def test_consumer_rejects_schema_validation_failure_to_dlx() -> None:
    """Verify schema validation error (missing required field) is rejected to DLX."""
    consumer = NotificationCommandConsumer()

    # Missing 'channel', 'title', 'message' for notification.send
    payload = {
        "command_id": str(uuid4()),
        "command_type": "notification.send",
        "user_id": str(uuid4()),
    }
    message_mock = AsyncMock()
    message_mock.body = json.dumps(payload).encode("utf-8")

    result = await consumer.process_message(message_mock)

    assert result is None
    message_mock.ack.assert_not_called()
    message_mock.nack.assert_awaited_once_with(requeue=False)


@pytest.mark.asyncio
async def test_consumer_start_and_stop_lifecycle() -> None:
    """Verify consumer start initializes topology and stop cleans up owned resources."""
    mock_conn = AsyncMock(spec=aio_pika.abc.AbstractRobustConnection)
    mock_conn.is_closed = False
    mock_chan = AsyncMock(spec=aio_pika.abc.AbstractRobustChannel)
    mock_chan.is_closed = False
    mock_conn.channel.return_value = mock_chan

    mock_queue = AsyncMock()
    mock_topology = {
        "dlx": AsyncMock(),
        "dlq": AsyncMock(),
        "exchange": AsyncMock(),
        "queue": mock_queue,
    }

    with patch(
        "notification_service.src.services.consumer.declare_queue_topology",
        new_callable=AsyncMock,
    ) as mock_decl:
        mock_decl.return_value = mock_topology

        consumer = NotificationCommandConsumer(connection=mock_conn, channel=mock_chan)
        assert not consumer.is_running

        await consumer.start()
        assert consumer.is_running
        assert consumer.queue == mock_queue

        # Subsequent start does nothing if running
        await consumer.start()

        await consumer.stop()
        assert not consumer.is_running
        assert consumer.queue is None


# ==============================================================================
# 6. Worker Lifecycle and Health Tests
# ==============================================================================


def test_get_service_status() -> None:
    """Verify worker service status returns standard ok health dict."""
    status = get_service_status()
    assert status == {"status": "ok", "service": "notification"}


@pytest.mark.asyncio
async def test_consume_messages_single_pass() -> None:
    """Verify consume_messages with stop_event=None runs single pass and finishes."""
    mock_consumer = AsyncMock(spec=NotificationCommandConsumer)
    await consume_messages(stop_event=None, consumer=mock_consumer)
    mock_consumer.start.assert_awaited_once()


@pytest.mark.asyncio
async def test_consume_messages_with_stop_event() -> None:
    """Verify consume_messages gracefully terminates when stop_event is set."""
    mock_consumer = AsyncMock(spec=NotificationCommandConsumer)

    stop_event = asyncio.Event()

    async def _simulate_run(event: asyncio.Event) -> None:
        await asyncio.sleep(0.01)
        event.set()

    asyncio.create_task(_simulate_run(stop_event))
    await consume_messages(stop_event=stop_event, consumer=mock_consumer)

    mock_consumer.start.assert_awaited_once()
    mock_consumer.consume.assert_awaited_once_with(stop_event)


@pytest.mark.asyncio
async def test_consume_events_alias() -> None:
    """Verify consume_events compatibility alias."""
    with patch(
        "notification_service.src.worker.consume_messages",
        new_callable=AsyncMock,
    ) as mock_cm:
        await consume_events(stop_event=None)
        mock_cm.assert_awaited_once_with(stop_event=None)


@pytest.mark.asyncio
async def test_run_worker_graceful() -> None:
    """Verify run_worker executes and halts when stop_event is signaled."""
    stop_event = asyncio.Event()
    stop_event.set()  # Already set to terminate immediately

    mock_consumer = AsyncMock(spec=NotificationCommandConsumer)
    await run_worker(stop_event=stop_event, consumer=mock_consumer)

    mock_consumer.start.assert_awaited_once()
