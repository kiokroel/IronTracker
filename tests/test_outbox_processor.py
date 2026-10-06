from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from aiokafka import AIOKafkaProducer
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from workout_service.src.core.config import get_settings
from workout_service.src.models.outbox import OutboxModel
from workout_service.src.services.outbox_processor import OutboxProcessor
from workout_service.src.worker import get_service_status, run_worker

_test_engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
_test_session_factory = async_sessionmaker(
    bind=_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(autouse=True)
async def _cleanup_outbox_table() -> AsyncGenerator[None, None]:
    """Isolate tests by removing outbox records before and after each test."""
    async with _test_session_factory() as session:
        await session.execute(delete(OutboxModel))
        await session.commit()
    yield
    async with _test_session_factory() as session:
        await session.execute(delete(OutboxModel))
        await session.commit()


@pytest.mark.asyncio
async def test_process_batch_success() -> None:
    """Verify that pending outbox entry transitions to 'processed' and processed_at is set."""
    event_id = uuid.uuid4()
    workout_id = uuid.uuid4()
    payload = {
        "event_id": str(event_id),
        "workout_id": str(workout_id),
        "event_type": "workout.created",
    }

    async with _test_session_factory() as session:
        entry = OutboxModel(
            id=event_id,
            event_type="workout.created",
            payload=payload,
            status="pending",
            retry_count=0,
            created_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()

    mock_producer = AsyncMock(spec=AIOKafkaProducer)
    processor = OutboxProcessor(producer=mock_producer, session_factory=_test_session_factory)

    async with _test_session_factory() as session:
        processed_count = await processor.process_batch(session)

    assert processed_count == 1
    mock_producer.send_and_wait.assert_awaited_once()
    call_args = mock_producer.send_and_wait.await_args
    assert call_args.args[0] == processor.topic
    assert call_args.kwargs["key"] == str(event_id).encode("utf-8")
    assert json.loads(call_args.kwargs["value"].decode("utf-8")) == payload

    async with _test_session_factory() as session:
        updated = await session.get(OutboxModel, event_id)
        assert updated is not None
        assert updated.status == "processed"
        assert updated.processed_at is not None


@pytest.mark.asyncio
async def test_process_batch_send_failure_increments_retry() -> None:
    """Verify that when send fails, status remains 'pending' and retry_count is incremented."""
    event_id = uuid.uuid4()
    payload = {"event_id": str(event_id)}

    async with _test_session_factory() as session:
        entry = OutboxModel(
            id=event_id,
            event_type="workout.created",
            payload=payload,
            status="pending",
            retry_count=0,
            created_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()

    mock_producer = AsyncMock(spec=AIOKafkaProducer)
    mock_producer.send_and_wait.side_effect = RuntimeError("Broker connection failed")
    processor = OutboxProcessor(producer=mock_producer, session_factory=_test_session_factory)

    async with _test_session_factory() as session:
        processed_count = await processor.process_batch(session)

    assert processed_count == 1
    mock_producer.send_and_wait.assert_awaited_once()

    async with _test_session_factory() as session:
        updated = await session.get(OutboxModel, event_id)
        assert updated is not None
        assert updated.status == "pending"
        assert updated.retry_count == 1
        assert updated.processed_at is None


@pytest.mark.asyncio
async def test_process_batch_max_retries_marks_failed() -> None:
    """Verify that when max_retries is reached, status is set to 'failed'."""
    event_id = uuid.uuid4()
    payload = {"event_id": str(event_id)}

    mock_producer = AsyncMock(spec=AIOKafkaProducer)
    mock_producer.send_and_wait.side_effect = RuntimeError("Broker connection timeout")
    processor = OutboxProcessor(producer=mock_producer, session_factory=_test_session_factory)

    initial_retry = processor.max_retries - 1
    async with _test_session_factory() as session:
        entry = OutboxModel(
            id=event_id,
            event_type="workout.created",
            payload=payload,
            status="pending",
            retry_count=initial_retry,
            created_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()

    async with _test_session_factory() as session:
        processed_count = await processor.process_batch(session)

    assert processed_count == 1

    async with _test_session_factory() as session:
        updated = await session.get(OutboxModel, event_id)
        assert updated is not None
        assert updated.status == "failed"
        assert updated.retry_count == processor.max_retries
        assert updated.processed_at is None


@pytest.mark.asyncio
async def test_process_batch_empty_queue() -> None:
    """Verify that empty queue returns 0 and producer is not called."""
    mock_producer = AsyncMock(spec=AIOKafkaProducer)
    processor = OutboxProcessor(producer=mock_producer, session_factory=_test_session_factory)

    async with _test_session_factory() as session:
        count = await processor.process_batch(session)

    assert count == 0
    mock_producer.send_and_wait.assert_not_called()


@pytest.mark.asyncio
async def test_worker_status_and_lifecycle() -> None:
    """Verify get_service_status and run_worker lifecycle with asyncio.Event."""
    status = get_service_status()
    assert status == {"status": "ok", "service": "workout_outbox_worker"}

    # Test run_worker with injected processor and stop_event
    producer = AsyncMock(spec=AIOKafkaProducer)
    processor = OutboxProcessor(producer=producer, session_factory=_test_session_factory)
    stop_event = asyncio.Event()
    stop_event.set()

    await run_worker(stop_event=stop_event, processor=processor)
    producer.stop.assert_awaited_once()

    # Test run_worker with patched OutboxProcessor instantiation
    with patch("workout_service.src.worker.OutboxProcessor") as mock_processor_cls:
        mock_instance = AsyncMock(spec=OutboxProcessor)
        mock_processor_cls.return_value = mock_instance
        stop_event_2 = asyncio.Event()
        stop_event_2.set()

        await run_worker(stop_event=stop_event_2)
        mock_instance.start.assert_awaited_once()
        mock_instance.run_loop.assert_awaited_once_with(stop_event=stop_event_2)
        mock_instance.stop.assert_awaited_once()
