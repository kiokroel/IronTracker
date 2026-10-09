from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from notification_service.src import (
    DLQRetryProcessor,
    NotificationCommandConsumer,
    NotificationDispatcher,
    NotificationDispatchResult,
    NotificationProviderError,
    Settings,
)
from shared.contracts.src.commands import (
    SendAchievementNotificationCommand,
    SendNotificationCommand,
)

# ==============================================================================
# 1. NotificationDispatchResult Schema Tests
# ==============================================================================


def test_notification_dispatch_result_schema() -> None:
    """Verify NotificationDispatchResult validation and serialization."""
    cmd_id = uuid4()
    usr_id = uuid4()

    res = NotificationDispatchResult(
        command_id=cmd_id,
        user_id=usr_id,
        channel="email",
        status="sent",
        details={"subject": "Workout summary"},
    )

    assert res.command_id == cmd_id
    assert res.user_id == usr_id
    assert res.channel == "email"
    assert res.status == "sent"
    assert res.details == {"subject": "Workout summary"}
    assert res.error_message is None
    assert res.timestamp is not None


def test_notification_dispatch_result_forbid_extra() -> None:
    """Verify NotificationDispatchResult forbids undeclared fields."""
    with pytest.raises(ValueError):
        NotificationDispatchResult(
            command_id=uuid4(),
            user_id=uuid4(),
            channel="push",
            status="sent",
            unexpected_field="disallowed",  # type: ignore[call-arg]
        )


# ==============================================================================
# 2. NotificationDispatcher Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_dispatcher_send_email_success() -> None:
    """Verify send_email simulates async email dispatch."""
    dispatcher = NotificationDispatcher()
    usr_id = uuid4()
    success = await dispatcher.send_email(
        user_id=usr_id,
        title="Weekly Report",
        message="Your weekly volume reached 25 tons!",
    )
    assert success is True


@pytest.mark.asyncio
async def test_dispatcher_send_push_success() -> None:
    """Verify send_push simulates async push dispatch."""
    dispatcher = NotificationDispatcher()
    usr_id = uuid4()
    success = await dispatcher.send_push(
        user_id=usr_id,
        title="Streak Reminder",
        message="Keep your gym streak alive today!",
    )
    assert success is True


@pytest.mark.asyncio
async def test_dispatcher_dispatch_send_notification_email() -> None:
    """Verify dispatching SendNotificationCommand with email channel."""
    dispatcher = NotificationDispatcher()
    cmd = SendNotificationCommand(
        user_id=uuid4(),
        channel="email",
        title="Workout Logged",
        message="Heavy bench press session successfully saved.",
    )

    result = await dispatcher.dispatch(cmd)
    assert result.status == "sent"
    assert result.channel == "email"
    assert result.user_id == cmd.user_id
    assert result.command_id == cmd.command_id
    assert result.details["title"] == cmd.title


@pytest.mark.asyncio
async def test_dispatcher_dispatch_send_notification_push() -> None:
    """Verify dispatching SendNotificationCommand with push channel."""
    dispatcher = NotificationDispatcher()
    cmd = SendNotificationCommand(
        user_id=uuid4(),
        channel="push",
        title="Rest Timer",
        message="3 minutes rest completed. Ready for next set!",
    )

    result = await dispatcher.dispatch(cmd)
    assert result.status == "sent"
    assert result.channel == "push"
    assert result.user_id == cmd.user_id


@pytest.mark.asyncio
async def test_dispatcher_dispatch_achievement_general() -> None:
    """Verify dispatching generic SendAchievementNotificationCommand."""
    dispatcher = NotificationDispatcher()
    cmd = SendAchievementNotificationCommand(
        user_id=uuid4(),
        achievement_code="FIRST_WORKOUT",
        title="First Step!",
        message="You logged your very first workout in IronTracker.",
    )

    result = await dispatcher.dispatch(cmd)
    assert result.status == "sent"
    assert result.channel == "push"
    assert result.details["achievement_code"] == "FIRST_WORKOUT"
    assert "🏆 First Step!" in result.details["title"]


@pytest.mark.asyncio
async def test_dispatcher_dispatch_achievement_bench_press_record() -> None:
    """Verify special formatting for bench_press_record personal records."""
    dispatcher = NotificationDispatcher()
    cmd = SendAchievementNotificationCommand(
        user_id=uuid4(),
        achievement_code="bench_press_record",
        title="Bench Press Milestone",
        message="Bench Press 120 kg x 3 reps logged!",
    )

    result = await dispatcher.dispatch(cmd)
    assert result.status == "sent"
    assert result.channel == "push"
    assert result.details["achievement_code"] == "bench_press_record"
    assert "New Personal Record!" in result.details["message"]
    assert "🏆 Bench Press Milestone" in result.details["title"]


@pytest.mark.asyncio
async def test_dispatcher_simulate_failure_raises_provider_error() -> None:
    """Verify simulate_failure=True raises NotificationProviderError."""
    dispatcher = NotificationDispatcher(simulate_failure=True)
    cmd = SendNotificationCommand(
        user_id=uuid4(),
        channel="email",
        title="Important",
        message="Should fail due to simulated outage.",
    )

    with pytest.raises(NotificationProviderError, match="Provider unavailable"):
        await dispatcher.dispatch(cmd)


@pytest.mark.asyncio
async def test_dispatcher_fail_rate_raises_provider_error() -> None:
    """Verify fail_rate=1.0 reliably triggers NotificationProviderError."""
    dispatcher = NotificationDispatcher(fail_rate=1.0)
    cmd = SendNotificationCommand(
        user_id=uuid4(),
        channel="push",
        title="Alert",
        message="Fail rate 1.0 triggers provider failure.",
    )

    with pytest.raises(NotificationProviderError, match="fail_rate triggered"):
        await dispatcher.dispatch(cmd)


# ==============================================================================
# 3. Consumer Integration with Dispatcher & DLX Routing Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_consumer_successful_dispatch_and_ack() -> None:
    """Verify consumer routes valid message to dispatcher, acks, and returns result."""
    dispatcher = NotificationDispatcher()
    consumer = NotificationCommandConsumer(dispatcher=dispatcher)

    user_id = uuid4()
    payload = {
        "command_id": str(uuid4()),
        "command_type": "notification.send",
        "user_id": str(user_id),
        "channel": "email",
        "title": "Workout Summary",
        "message": "Workout saved successfully.",
    }

    message_mock = AsyncMock()
    message_mock.body = json.dumps(payload).encode("utf-8")

    result = await consumer.process_message(message_mock)

    assert isinstance(result, NotificationDispatchResult)
    assert result.status == "sent"
    assert result.user_id == user_id
    message_mock.ack.assert_awaited_once()
    message_mock.nack.assert_not_called()


@pytest.mark.asyncio
async def test_consumer_provider_error_routes_to_dlx_via_nack() -> None:
    """Verify provider failure causes nack(requeue=False), sending message to DLX."""
    failing_dispatcher = NotificationDispatcher(simulate_failure=True)
    consumer = NotificationCommandConsumer(dispatcher=failing_dispatcher)

    payload = {
        "command_id": str(uuid4()),
        "command_type": "notification.send",
        "user_id": str(uuid4()),
        "channel": "email",
        "title": "Outage Test",
        "message": "Message destined for DLX upon failure.",
    }

    message_mock = AsyncMock()
    message_mock.body = json.dumps(payload).encode("utf-8")

    result = await consumer.process_message(message_mock)

    assert result is None
    message_mock.ack.assert_not_called()
    message_mock.nack.assert_awaited_once_with(requeue=False)


# ==============================================================================
# 4. DLQ Retry Mechanism Tests
# ==============================================================================


def test_dlq_extract_retry_count() -> None:
    """Verify DLQRetryProcessor extracts retry count from various header structures."""
    processor = DLQRetryProcessor(max_retries=3)

    assert processor.extract_retry_count(None) == 0
    assert processor.extract_retry_count({}) == 0
    assert processor.extract_retry_count({"x-retry-count": 2}) == 2
    assert processor.extract_retry_count({"x-retry-count": "invalid"}) == 0
    assert processor.extract_retry_count({"x-death": [{"count": 4}]}) == 4


def test_dlq_should_retry() -> None:
    """Verify should_retry evaluates current_retry against max_retries limit."""
    processor = DLQRetryProcessor(max_retries=3)

    assert processor.should_retry(headers={}, current_retry=0) is True
    assert processor.should_retry(headers={}, current_retry=2) is True
    assert processor.should_retry(headers={}, current_retry=3) is False
    assert processor.should_retry(headers={}, current_retry=4) is False


@pytest.mark.asyncio
async def test_dlq_process_message_republishes_when_retries_remain() -> None:
    """Verify eligible DLQ message is republished to main exchange and acked."""
    settings = Settings(
        rabbitmq_exchange="notifications_exchange",
        rabbitmq_routing_key="notification.dispatch",
    )
    processor = DLQRetryProcessor(max_retries=3, settings=settings)

    channel_mock = AsyncMock()
    exchange_mock = AsyncMock()
    channel_mock.get_exchange.return_value = exchange_mock

    message_mock = AsyncMock()
    message_mock.body = b'{"command_id": "test"}'
    message_mock.headers = {"x-retry-count": 1}

    success = await processor.process_dlq_message(message_mock, channel=channel_mock)

    assert success is True
    channel_mock.get_exchange.assert_called_once_with(
        "notifications_exchange",
        ensure=False,
    )
    exchange_mock.publish.assert_awaited_once()

    # Check published message headers
    call_args = exchange_mock.publish.await_args
    published_msg = call_args[0][0]
    assert published_msg.headers["x-retry-count"] == 2
    assert call_args[1]["routing_key"] == "notification.dispatch"

    message_mock.ack.assert_awaited_once()


@pytest.mark.asyncio
async def test_dlq_process_message_drops_when_max_retries_exceeded() -> None:
    """Verify DLQ message exceeding max retries is acknowledged without republishing."""
    settings = Settings()
    processor = DLQRetryProcessor(max_retries=3, settings=settings)

    channel_mock = AsyncMock()
    exchange_mock = AsyncMock()
    channel_mock.get_exchange.return_value = exchange_mock

    message_mock = AsyncMock()
    message_mock.body = b'{"command_id": "failed"}'
    message_mock.headers = {"x-retry-count": 3}

    success = await processor.process_dlq_message(message_mock, channel=channel_mock)

    assert success is False
    channel_mock.get_exchange.assert_not_called()
    exchange_mock.publish.assert_not_called()
    message_mock.ack.assert_awaited_once()
