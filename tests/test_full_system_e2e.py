from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from aiokafka import AIOKafkaProducer
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from analytics_service.src.core.database import close_mongo_client, get_mongo_database
from analytics_service.src.repositories.analytics import AnalyticsRepository
from analytics_service.src.services.analytics import AnalyticsService
from leaderboard_service.src.core.config import get_settings as get_leaderboard_settings
from leaderboard_service.src.services.consumer import WorkoutEventConsumer
from leaderboard_service.src.services.leaderboard import LeaderboardService
from notification_service.src.services.consumer import NotificationCommandConsumer
from notification_service.src.services.dispatcher import NotificationDispatcher
from notification_service.src.services.retry import DLQRetryProcessor
from shared.contracts.src.commands import SendAchievementNotificationCommand
from shared.contracts.src.events import WorkoutCompletedEvent
from shared.contracts.src.metrics import BenchPressMetrics, StrengthExerciseMetrics
from workout_service.src.controllers.workout import WorkoutController
from workout_service.src.core.config import get_settings as get_workout_settings
from workout_service.src.models.outbox import OutboxModel
from workout_service.src.models.workout import WorkoutModel
from workout_service.src.schemas.workout import WorkoutCreate
from workout_service.src.services.outbox_processor import OutboxProcessor

# Isolated database engine and session factory for PostgreSQL
_workout_settings = get_workout_settings()
_pg_engine = create_async_engine(_workout_settings.database_url, poolclass=NullPool)
_session_factory = async_sessionmaker(
    bind=_pg_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture
async def pg_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield isolated database session for Workout Service tests."""
    async with _session_factory() as session:
        yield session


@pytest.fixture
async def redis_client() -> AsyncGenerator[Redis, None]:
    """Yield real Redis client connected to Docker Redis instance."""
    lb_settings = get_leaderboard_settings()
    client: Redis = Redis.from_url(lb_settings.redis_url, decode_responses=True)
    yield client
    await client.aclose()


@pytest.fixture(autouse=True)
async def cleanup_mongo_client_fixture() -> AsyncGenerator[None, None]:
    """Ensure Motor MongoDB client connection is closed per test."""
    yield
    await close_mongo_client()


# ==============================================================================
# Step 1: Caddy API Gateway Verification (Docker Container on Port 80)
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_step1_caddy_gateway_health() -> None:
    """Verify Caddy API Gateway proxies /health endpoint with 200 OK."""
    gateway_url = "http://127.0.0.1:80"
    async with httpx.AsyncClient(base_url=gateway_url, timeout=5.0) as client:
        try:
            response = await client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data.get("status") == "ok"
            assert data.get("service") == "caddy-gateway"

            # Check 404 fallback routing for unmatched API routes
            fallback_res = await client.get("/api/non-existent-endpoint-404")
            assert fallback_res.status_code == 404
            assert fallback_res.json().get("detail") == "Not Found"
        except httpx.ConnectError:
            pytest.skip("Caddy API Gateway is not reachable on port 80.")


# ==============================================================================
# Step 2: Workout Service Creation & Transactional Outbox (PostgreSQL)
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_step2_workout_creation_and_transactional_outbox(
    pg_session: AsyncSession,
) -> None:
    """Verify Workout creation writes to PostgreSQL.

    Ensures pending outbox event is created in the same transaction.
    """
    user_id = uuid4()
    workout_create = WorkoutCreate(
        user_id=user_id,
        type="bench_press",
        date=datetime.now(UTC),
        metrics=StrengthExerciseMetrics(
            exercise_type="strength",
            exercise_name="bench_press",
            weight=140.0,
            sets=5,
            reps=5,
            rpe=9.0,
        ),
    )

    controller = WorkoutController(pg_session)

    # Execute creation
    workout_response = await controller.create_workout(
        workout_create, event_type="workout.completed"
    )
    workout_id = workout_response.id

    assert workout_response.user_id == user_id
    assert workout_response.metrics["weight"] == 140.0
    assert workout_response.metrics["sets"] == 5
    assert workout_response.metrics["reps"] == 5

    # Verify atomic persistence in PostgreSQL
    saved_workout = await pg_session.get(WorkoutModel, workout_id)
    assert saved_workout is not None
    assert saved_workout.user_id == user_id
    assert saved_workout.metrics["weight"] == 140.0

    # Verify pending Transactional Outbox event
    stmt = select(OutboxModel).where(
        OutboxModel.payload["workout_id"].as_string() == str(workout_id)
    )
    res = await pg_session.execute(stmt)
    outbox_entry = res.scalar_one_or_none()

    assert outbox_entry is not None
    assert outbox_entry.event_type in ("workout.completed", "workout.created")
    assert outbox_entry.status == "pending"
    assert outbox_entry.retry_count == 0
    assert outbox_entry.payload["workout_id"] == str(workout_id)
    assert outbox_entry.payload["user_id"] == str(user_id)
    assert outbox_entry.payload["metrics"]["weight"] == 140.0
    assert outbox_entry.payload["metrics"]["sets"] == 5
    assert outbox_entry.payload["metrics"]["reps"] == 5

    # Cleanup test records
    await pg_session.delete(saved_workout)
    await pg_session.delete(outbox_entry)
    await pg_session.commit()


# ==============================================================================
# Step 3: Outbox Relay Processor (PostgreSQL Outbox -> Kafka Topic)
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_step3_outbox_relay_processor(pg_session: AsyncSession) -> None:
    """Verify OutboxProcessor reads pending events, publishes to Kafka, and marks processed."""
    event_id = uuid4()
    workout_id = uuid4()
    user_id = uuid4()
    payload = {
        "event_id": str(event_id),
        "workout_id": str(workout_id),
        "user_id": str(user_id),
        "event_type": "workout.completed",
        "occurred_at": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "bench_press",
            "weight": 140.0,
            "sets": 5,
            "reps": 5,
        },
    }

    outbox_entry = OutboxModel(
        id=event_id,
        event_type="workout.completed",
        payload=payload,
        status="pending",
        retry_count=0,
        created_at=datetime.now(UTC),
    )
    pg_session.add(outbox_entry)
    await pg_session.commit()

    # OutboxProcessor with mocked Kafka producer
    mock_producer = AsyncMock(spec=AIOKafkaProducer)
    processor = OutboxProcessor(producer=mock_producer, session_factory=_session_factory)

    async with _session_factory() as proc_session:
        processed_count = await processor.process_batch(proc_session)

    assert processed_count >= 1
    mock_producer.send_and_wait.assert_awaited()

    # Verify status changed to 'processed'
    async with _session_factory() as check_session:
        updated = await check_session.get(OutboxModel, event_id)
        assert updated is not None
        assert updated.status == "processed"
        assert updated.processed_at is not None

        # Cleanup
        await check_session.delete(updated)
        await check_session.commit()


# ==============================================================================
# Step 4: Real-time Leaderboard Service (Redis ZSET on Docker)
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_step4_leaderboard_realtime_tonnage_redis(
    redis_client: Redis,
) -> None:
    """Verify Leaderboard Service computes tonnage (140 * 5 * 5 = 3500 kg) and updates Redis."""
    user_id = uuid4()
    user_id_str = str(user_id)
    tonnage_key = "leaderboard:tonnage"

    # Clean user score if existed
    await redis_client.zrem(tonnage_key, user_id_str)

    event = WorkoutCompletedEvent(
        workout_id=uuid4(),
        user_id=user_id,
        completed_at=datetime.now(UTC),
        metrics=BenchPressMetrics(
            exercise_type="bench_press",
            weight=140.0,
            sets=5,
            reps=5,
        ),
    )

    # Process via WorkoutEventConsumer
    consumer = WorkoutEventConsumer(redis=redis_client)
    updated_tonnage = await consumer.process_message(event)

    assert updated_tonnage == 3500.0

    # Verify directly from Redis ZSET
    raw_score = await redis_client.zscore(tonnage_key, user_id_str)
    assert raw_score is not None
    assert float(raw_score) == 3500.0

    # Verify via LeaderboardService API
    lb_service = LeaderboardService(redis=redis_client)
    user_rank = await lb_service.get_user_tonnage_rank(user_id)
    assert user_rank is not None
    assert user_rank.user_id == user_id
    assert user_rank.score == 3500.0
    assert user_rank.rank is not None
    assert user_rank.rank >= 1

    # Cleanup
    await redis_client.zrem(tonnage_key, user_id_str)


# ==============================================================================
# Step 5: Analytics Service (MongoDB Time Series & 7 1RM Formulas)
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_step5_analytics_mongodb_timeseries_and_1rm() -> None:
    """Verify Analytics computes 1RM via 7 formulas and persists Time Series point to MongoDB."""
    user_id = uuid4()
    workout_id = uuid4()

    event = WorkoutCompletedEvent(
        workout_id=workout_id,
        user_id=user_id,
        completed_at=datetime.now(UTC),
        metrics=BenchPressMetrics(
            exercise_type="bench_press",
            weight=140.0,
            sets=5,
            reps=5,
            rpe=9.0,
        ),
    )

    # Connect to MongoDB
    mongo_db = get_mongo_database()
    repository = AnalyticsRepository(db=mongo_db)
    service = AnalyticsService(repository=repository)

    point = await service.process_workout_completed_event(event)

    assert point.metadata.user_id == str(user_id)
    assert point.metadata.workout_id == str(workout_id)
    assert point.metadata.exercise_type == "bench_press"
    assert point.tonnage == 3500.0
    assert point.weight == 140.0
    assert point.sets == 5
    assert point.reps == 5

    # Verify 1RM breakdown (7 formulas)
    assert point.detailed_1rm is not None
    detailed = point.detailed_1rm
    # Epley: 140 * (1 + 5/30) = 163.33
    assert detailed.epley == 163.33
    # Brzycki: 140 * 36 / (37 - 5) = 157.50
    assert detailed.brzycki == 157.50
    # Lander: (100 * 140) / (101.3 - 2.67123 * 5) = 159.19
    assert detailed.lander == 159.19
    # Verify remaining formulas exist and positive
    assert detailed.lombardi > 140.0
    assert detailed.mayhew > 140.0
    assert detailed.o_conner > 140.0
    assert detailed.wathan > 140.0
    assert point.one_rep_max is not None
    assert point.one_rep_max > 150.0

    # Query MongoDB collection directly
    collection = await repository.get_collection()
    found_doc = await collection.find_one({"metadata.workout_id": str(workout_id)})
    assert found_doc is not None
    assert found_doc["metadata"]["user_id"] == str(user_id)
    assert found_doc["tonnage"] == 3500.0
    assert found_doc["detailed_1rm"]["epley"] == 163.33

    # Cleanup MongoDB record
    await collection.delete_one({"metadata.workout_id": str(workout_id)})


# ==============================================================================
# Step 6: Notification Service (RabbitMQ Dispatch & Ack)
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_step6_notification_command_dispatch_and_ack() -> None:
    """Verify Notification Service dispatches achievement command and acknowledges message."""
    user_id = uuid4()
    cmd = SendAchievementNotificationCommand(
        user_id=user_id,
        achievement_code="bench_press_record",
        title="Bench Press Personal Record",
        message="Congratulations! You logged 140.0 kg for 5x5!",
    )

    dispatcher = NotificationDispatcher()
    consumer = NotificationCommandConsumer(dispatcher=dispatcher)

    message_mock = AsyncMock()
    message_mock.body = json.dumps(cmd.model_dump(mode="json")).encode("utf-8")

    result = await consumer.process_message(message_mock)

    assert result is not None
    assert result.status == "sent"
    assert result.channel == "push"
    assert result.user_id == user_id
    assert result.details["achievement_code"] == "bench_press_record"
    message_mock.ack.assert_awaited_once()
    message_mock.nack.assert_not_called()


# ==============================================================================
# Step 7: Dead Letter Exchange & DLQ Retry (RabbitMQ DLX/DLQ Simulation)
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_step7_notification_dlx_and_dlq_retry() -> None:
    """Verify provider error sends message to DLX and DLQ retry processor handles it."""
    # 1. Failure routing to DLX
    failing_dispatcher = NotificationDispatcher(simulate_failure=True)
    consumer = NotificationCommandConsumer(dispatcher=failing_dispatcher)

    payload = {
        "command_id": str(uuid4()),
        "command_type": "notification.send",
        "user_id": str(uuid4()),
        "channel": "email",
        "title": "Service Outage Test",
        "message": "Testing automatic DLX routing.",
    }

    fail_message_mock = AsyncMock()
    fail_message_mock.body = json.dumps(payload).encode("utf-8")

    result = await consumer.process_message(fail_message_mock)

    assert result is None
    fail_message_mock.ack.assert_not_called()
    fail_message_mock.nack.assert_awaited_once_with(requeue=False)

    # 2. DLQ Retry Processor handles message from DLQ
    processor = DLQRetryProcessor(max_retries=3)
    channel_mock = AsyncMock()
    exchange_mock = AsyncMock()
    channel_mock.get_exchange.return_value = exchange_mock

    dlq_message_mock = AsyncMock()
    dlq_message_mock.body = json.dumps(payload).encode("utf-8")
    dlq_message_mock.headers = {"x-retry-count": 1}

    retry_success = await processor.process_dlq_message(dlq_message_mock, channel=channel_mock)

    assert retry_success is True
    channel_mock.get_exchange.assert_called_once_with(
        "notifications_exchange",
        ensure=False,
    )
    exchange_mock.publish.assert_awaited_once()
    call_args = exchange_mock.publish.await_args
    published_msg = call_args[0][0]
    assert published_msg.headers["x-retry-count"] == 2
    dlq_message_mock.ack.assert_awaited_once()


# ==============================================================================
# Full End-to-End Orchestrated System Flow Test
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_full_system_lifecycle_flow(
    pg_session: AsyncSession,
    redis_client: Redis,
) -> None:
    """Verify complete end-to-end integration lifecycle across all services."""
    user_id = uuid4()
    user_id_str = str(user_id)
    tonnage_key = "leaderboard:tonnage"

    # Clean pre-existing state
    await redis_client.zrem(tonnage_key, user_id_str)

    # 1. Workout Service creates workout and Transactional Outbox
    workout_create = WorkoutCreate(
        user_id=user_id,
        type="bench_press",
        date=datetime.now(UTC),
        metrics=StrengthExerciseMetrics(
            exercise_type="strength",
            exercise_name="bench_press",
            weight=140.0,
            sets=5,
            reps=5,
            rpe=9.0,
        ),
    )
    controller = WorkoutController(pg_session)
    workout_response = await controller.create_workout(
        workout_create, event_type="workout.completed"
    )
    workout_id = workout_response.id

    # 2. Outbox Processor processes event
    mock_producer = AsyncMock(spec=AIOKafkaProducer)
    outbox_processor = OutboxProcessor(
        producer=mock_producer,
        session_factory=_session_factory,
    )
    async with _session_factory() as batch_session:
        processed_count = await outbox_processor.process_batch(batch_session)
    assert processed_count >= 1

    # 3. Leaderboard updates tonnage in Redis
    event = WorkoutCompletedEvent(
        workout_id=workout_id,
        user_id=user_id,
        completed_at=datetime.now(UTC),
        metrics=BenchPressMetrics(
            exercise_type="bench_press",
            weight=140.0,
            sets=5,
            reps=5,
        ),
    )
    lb_consumer = WorkoutEventConsumer(redis=redis_client)
    tonnage = await lb_consumer.process_message(event)
    assert tonnage == 3500.0

    lb_service = LeaderboardService(redis=redis_client)
    user_rank = await lb_service.get_user_tonnage_rank(user_id)
    assert user_rank.score == 3500.0
    assert user_rank.rank is not None
    assert user_rank.rank >= 1

    # 4. Analytics records metrics in MongoDB Time Series
    mongo_db = get_mongo_database()
    analytics_repo = AnalyticsRepository(db=mongo_db)
    analytics_service = AnalyticsService(repository=analytics_repo)
    point = await analytics_service.process_workout_completed_event(event)
    assert point.detailed_1rm is not None
    assert point.detailed_1rm.epley == 163.33

    # 5. Notification dispatches milestone command
    cmd = SendAchievementNotificationCommand(
        user_id=user_id,
        achievement_code="bench_press_record",
        title="Personal Record",
        message="140 kg 5x5 registered!",
    )
    notif_consumer = NotificationCommandConsumer(dispatcher=NotificationDispatcher())
    msg_mock = AsyncMock()
    msg_mock.body = json.dumps(cmd.model_dump(mode="json")).encode("utf-8")
    notif_result = await notif_consumer.process_message(msg_mock)
    assert notif_result is not None
    assert notif_result.status == "sent"

    # Cleanup
    await redis_client.zrem(tonnage_key, user_id_str)
    analytics_col = await analytics_repo.get_collection()
    await analytics_col.delete_one({"metadata.workout_id": str(workout_id)})
    async with _session_factory() as cleanup_session:
        saved_workout = await cleanup_session.get(WorkoutModel, workout_id)
        if saved_workout:
            await cleanup_session.delete(saved_workout)
        stmt = select(OutboxModel).where(
            OutboxModel.payload["workout_id"].as_string() == str(workout_id)
        )
        res = await cleanup_session.execute(stmt)
        for ob in res.scalars().all():
            await cleanup_session.delete(ob)
        await cleanup_session.commit()
