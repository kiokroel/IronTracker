from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from aiokafka import AIOKafkaConsumer
from redis.asyncio import Redis

from leaderboard_service.src import (
    KafkaSettings,
    Settings,
    WorkoutEventConsumer,
    calculate_workout_tonnage,
    get_service_status,
    run_worker,
    update_user_tonnage,
)
from leaderboard_service.src.main import app, lifespan
from shared.contracts.src.events import WorkoutCompletedEvent
from shared.contracts.src.metrics import (
    BenchPressMetrics,
    CardioExerciseMetrics,
    DeadliftMetrics,
    SquatMetrics,
    StrengthExerciseMetrics,
    TreadmillMetrics,
)

# ==============================================================================
# 1. Tonnage Calculation Unit Tests (calculate_workout_tonnage)
# ==============================================================================


def test_calculate_tonnage_bench_press_standard() -> None:
    """Verify bench press tonnage calculation: weight * sets * reps."""
    metrics = BenchPressMetrics(
        exercise_type="bench_press",
        weight=100.0,
        sets=3,
        reps=10,
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 3000.0


def test_calculate_tonnage_bench_press_alias() -> None:
    """Verify bench press alias ('benchpress') tonnage calculation."""
    metrics = BenchPressMetrics(
        exercise_type="benchpress",
        weight=85.0,
        sets=4,
        reps=8,
        rpe=8.5,
        grip_width_cm=81.0,
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 2720.0


def test_calculate_tonnage_squats_standard() -> None:
    """Verify squat tonnage calculation: weight * sets * reps."""
    metrics = SquatMetrics(
        exercise_type="squats",
        weight=140.0,
        sets=5,
        reps=5,
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 3500.0


def test_calculate_tonnage_squat_alias() -> None:
    """Verify squat alias ('squat') tonnage calculation with stance."""
    metrics = SquatMetrics(
        exercise_type="squat",
        weight=125.0,
        sets=3,
        reps=6,
        stance="wide",
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 2250.0


def test_calculate_tonnage_deadlift_conventional() -> None:
    """Verify deadlift tonnage calculation with conventional style."""
    metrics = DeadliftMetrics(
        exercise_type="deadlift",
        weight=180.0,
        sets=4,
        reps=4,
        deadlift_style="conventional",
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 2880.0


def test_calculate_tonnage_deadlift_sumo() -> None:
    """Verify deadlift tonnage calculation with sumo style."""
    metrics = DeadliftMetrics(
        exercise_type="deadlift",
        weight=200.0,
        sets=3,
        reps=3,
        deadlift_style="sumo",
        rpe=9.0,
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 1800.0


def test_calculate_tonnage_strength_exercise() -> None:
    """Verify arbitrary strength exercise tonnage calculation."""
    metrics = StrengthExerciseMetrics(
        exercise_type="strength",
        exercise_name="overhead_press",
        weight=60.0,
        sets=4,
        reps=8,
        rpe=8.0,
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 1920.0


def test_calculate_tonnage_cardio_exercise_returns_zero() -> None:
    """Verify cardio exercise does not contribute to lifting tonnage (returns 0.0)."""
    metrics = CardioExerciseMetrics(
        exercise_type="cardio",
        exercise_name="rowing",
        distance_km=5.0,
        duration_minutes=25.0,
        heart_rate=145,
        calories_burned=300,
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 0.0


def test_calculate_tonnage_treadmill_returns_zero() -> None:
    """Verify treadmill exercise returns 0.0 tonnage."""
    metrics = TreadmillMetrics(
        exercise_type="treadmill",
        distance_km=10.0,
        duration_minutes=50.0,
        speed_kmh=12.0,
        pace_min_per_km=5.0,
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 0.0


def test_calculate_tonnage_running_alias_returns_zero() -> None:
    """Verify treadmill alias ('running') returns 0.0 tonnage."""
    metrics = TreadmillMetrics(
        exercise_type="running",
        distance_km=7.5,
        duration_minutes=40.0,
    )
    tonnage = calculate_workout_tonnage(metrics)
    assert tonnage == 0.0


def test_calculate_tonnage_unknown_exercise_type() -> None:
    """Verify unknown or unhandled object returns 0.0."""
    dummy_obj = MagicMock()
    dummy_obj.exercise_type = "unknown_sport"
    del dummy_obj.weight
    tonnage = calculate_workout_tonnage(dummy_obj)
    assert tonnage == 0.0


# ==============================================================================
# 2. Redis ZSET Update Unit Tests (update_user_tonnage)
# ==============================================================================


@pytest.mark.asyncio
async def test_update_user_tonnage_positive() -> None:
    """Verify update_user_tonnage executes zincrby and returns updated score."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zincrby = AsyncMock(return_value=4500.0)

    user_id = uuid4()
    new_score = await update_user_tonnage(
        redis=mock_redis,
        user_id=user_id,
        tonnage=1500.0,
        leaderboard_key="leaderboard:custom",
    )

    assert new_score == 4500.0
    mock_redis.zincrby.assert_awaited_once_with(
        name="leaderboard:custom",
        amount=1500.0,
        value=str(user_id),
    )


@pytest.mark.asyncio
async def test_update_user_tonnage_default_key() -> None:
    """Verify default leaderboard_key falls back to settings.leaderboard_tonnage_key."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zincrby = AsyncMock(return_value=3000.0)

    user_id = uuid4()
    new_score = await update_user_tonnage(
        redis=mock_redis,
        user_id=user_id,
        tonnage=3000.0,
    )

    assert new_score == 3000.0
    mock_redis.zincrby.assert_awaited_once_with(
        name="leaderboard:tonnage",
        amount=3000.0,
        value=str(user_id),
    )


@pytest.mark.asyncio
async def test_update_user_tonnage_zero_does_not_call_redis() -> None:
    """Verify update_user_tonnage skips Redis call when tonnage is 0.0."""
    mock_redis = AsyncMock(spec=Redis)

    user_id = uuid4()
    score = await update_user_tonnage(
        redis=mock_redis,
        user_id=user_id,
        tonnage=0.0,
    )

    assert score == 0.0
    mock_redis.zincrby.assert_not_called()


@pytest.mark.asyncio
async def test_update_user_tonnage_negative_does_not_call_redis() -> None:
    """Verify update_user_tonnage skips Redis call when tonnage is negative."""
    mock_redis = AsyncMock(spec=Redis)

    user_id = uuid4()
    score = await update_user_tonnage(
        redis=mock_redis,
        user_id=user_id,
        tonnage=-500.0,
    )

    assert score == 0.0
    mock_redis.zincrby.assert_not_called()


# ==============================================================================
# 3. WorkoutEventConsumer Message Processing Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_process_message_valid_event_object() -> None:
    """Verify process_message processes WorkoutCompletedEvent object successfully."""
    user_id = uuid4()
    workout_id = uuid4()
    event = WorkoutCompletedEvent(
        event_type="workout.completed",
        workout_id=workout_id,
        user_id=user_id,
        completed_at=datetime.now(UTC),
        metrics=BenchPressMetrics(
            exercise_type="bench_press",
            weight=100.0,
            sets=3,
            reps=10,
        ),
    )

    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zincrby = AsyncMock(return_value=3000.0)

    consumer = WorkoutEventConsumer(redis=mock_redis)
    result = await consumer.process_message(event)

    assert result == 3000.0
    mock_redis.zincrby.assert_awaited_once_with(
        name="leaderboard:tonnage",
        amount=3000.0,
        value=str(user_id),
    )


@pytest.mark.asyncio
async def test_process_message_valid_json_bytes() -> None:
    """Verify process_message parses UTF-8 JSON bytes from ConsumerRecord."""
    user_id = uuid4()
    workout_id = uuid4()
    event_id = uuid4()
    payload = {
        "event_id": str(event_id),
        "event_type": "workout.completed",
        "workout_id": str(workout_id),
        "user_id": str(user_id),
        "completed_at": datetime.now(UTC).isoformat(),
        "occurred_at": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "squats",
            "weight": 120.0,
            "sets": 4,
            "reps": 5,
        },
    }
    raw_bytes = json.dumps(payload).encode("utf-8")

    # Mock ConsumerRecord with .value attribute
    mock_record = MagicMock()
    mock_record.value = raw_bytes

    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zincrby = AsyncMock(return_value=2400.0)

    consumer = WorkoutEventConsumer(redis=mock_redis)
    result = await consumer.process_message(mock_record)

    assert result == 2400.0
    mock_redis.zincrby.assert_awaited_once_with(
        name="leaderboard:tonnage",
        amount=2400.0,
        value=str(user_id),
    )


@pytest.mark.asyncio
async def test_process_message_valid_json_string() -> None:
    """Verify process_message parses JSON string directly."""
    user_id = uuid4()
    workout_id = uuid4()
    payload = {
        "event_id": str(uuid4()),
        "event_type": "workout.completed",
        "workout_id": str(workout_id),
        "user_id": str(user_id),
        "completed_at": datetime.now(UTC).isoformat(),
        "occurred_at": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "deadlift",
            "weight": 150.0,
            "sets": 3,
            "reps": 5,
        },
    }
    raw_str = json.dumps(payload)

    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zincrby = AsyncMock(return_value=2250.0)

    consumer = WorkoutEventConsumer(redis=mock_redis)
    result = await consumer.process_message(raw_str)

    assert result == 2250.0
    mock_redis.zincrby.assert_awaited_once()


@pytest.mark.asyncio
async def test_process_message_valid_dict() -> None:
    """Verify process_message accepts Python dictionary payload."""
    user_id = uuid4()
    workout_id = uuid4()
    payload = {
        "event_id": str(uuid4()),
        "event_type": "workout.completed",
        "workout_id": str(workout_id),
        "user_id": str(user_id),
        "completed_at": datetime.now(UTC).isoformat(),
        "occurred_at": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "strength",
            "exercise_name": "bicep_curl",
            "weight": 20.0,
            "sets": 3,
            "reps": 12,
        },
    }

    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zincrby = AsyncMock(return_value=720.0)

    consumer = WorkoutEventConsumer(redis=mock_redis)
    result = await consumer.process_message(payload)

    assert result == 720.0
    mock_redis.zincrby.assert_awaited_once_with(
        name="leaderboard:tonnage",
        amount=720.0,
        value=str(user_id),
    )


@pytest.mark.asyncio
async def test_process_message_cardio_no_redis_increment() -> None:
    """Verify process_message with cardio metrics produces 0 tonnage and does not call zincrby."""
    user_id = uuid4()
    workout_id = uuid4()
    event = WorkoutCompletedEvent(
        event_type="workout.completed",
        workout_id=workout_id,
        user_id=user_id,
        completed_at=datetime.now(UTC),
        metrics=CardioExerciseMetrics(
            exercise_type="cardio",
            exercise_name="treadmill_jog",
            distance_km=5.0,
            duration_minutes=30.0,
        ),
    )

    mock_redis = AsyncMock(spec=Redis)
    consumer = WorkoutEventConsumer(redis=mock_redis)
    result = await consumer.process_message(event)

    assert result == 0.0
    mock_redis.zincrby.assert_not_called()


# ==============================================================================
# 4. Corrupted & Error Message Handling Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_process_message_corrupted_json() -> None:
    """Verify corrupted JSON string does not raise unhandled error and returns None."""
    mock_redis = AsyncMock(spec=Redis)
    consumer = WorkoutEventConsumer(redis=mock_redis)

    result = await consumer.process_message(b"{invalid-json-payload-corrupted")
    assert result is None
    mock_redis.zincrby.assert_not_called()


@pytest.mark.asyncio
async def test_process_message_invalid_schema_missing_fields() -> None:
    """Verify message missing required schema fields returns None and does not crash."""
    mock_redis = AsyncMock(spec=Redis)
    consumer = WorkoutEventConsumer(redis=mock_redis)

    invalid_payload = json.dumps({"event_type": "workout.completed"}).encode("utf-8")
    result = await consumer.process_message(invalid_payload)

    assert result is None
    mock_redis.zincrby.assert_not_called()


@pytest.mark.asyncio
async def test_process_message_unexpected_event_type() -> None:
    """Verify events with unexpected event_type are ignored without error."""
    mock_redis = AsyncMock(spec=Redis)
    consumer = WorkoutEventConsumer(redis=mock_redis)

    payload = {
        "event_id": str(uuid4()),
        "event_type": "workout.unknown",
        "workout_id": str(uuid4()),
        "user_id": str(uuid4()),
        "created_at": datetime.now(UTC).isoformat(),
        "occurred_at": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "bench_press",
            "weight": 100.0,
            "sets": 3,
            "reps": 10,
        },
    }
    result = await consumer.process_message(payload)
    assert result is None
    mock_redis.zincrby.assert_not_called()


@pytest.mark.asyncio
async def test_process_message_workout_created_event() -> None:
    """Verify workout.created events are processed and update user score in Redis."""
    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zincrby = AsyncMock(return_value=3000.0)
    consumer = WorkoutEventConsumer(redis=mock_redis)

    user_id = uuid4()
    workout_id = uuid4()
    payload = {
        "event_id": str(uuid4()),
        "event_type": "workout.created",
        "workout_id": str(workout_id),
        "user_id": str(user_id),
        "created_at": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "bench_press",
            "weight": 100.0,
            "sets": 3,
            "reps": 10,
        },
    }
    result = await consumer.process_message(payload)
    assert result == 3000.0
    mock_redis.zincrby.assert_awaited_once_with(
        name="leaderboard:tonnage",
        amount=3000.0,
        value=str(user_id),
    )


@pytest.mark.asyncio
async def test_process_message_unsupported_data_type() -> None:
    """Verify non-deserializable object returns None."""
    mock_redis = AsyncMock(spec=Redis)
    consumer = WorkoutEventConsumer(redis=mock_redis)

    result = await consumer.process_message(12345)
    assert result is None
    mock_redis.zincrby.assert_not_called()


@pytest.mark.asyncio
async def test_process_message_redis_error_handled_gracefully() -> None:
    """Verify Redis connection error during zincrby is caught and returns None."""
    user_id = uuid4()
    workout_id = uuid4()
    event = WorkoutCompletedEvent(
        event_type="workout.completed",
        workout_id=workout_id,
        user_id=user_id,
        completed_at=datetime.now(UTC),
        metrics=BenchPressMetrics(
            exercise_type="bench_press",
            weight=100.0,
            sets=3,
            reps=10,
        ),
    )

    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zincrby = AsyncMock(side_effect=ConnectionError("Redis connection lost"))

    consumer = WorkoutEventConsumer(redis=mock_redis)
    result = await consumer.process_message(event)

    assert result is None
    mock_redis.zincrby.assert_awaited_once()


@pytest.mark.asyncio
async def test_process_message_without_redis_raises_runtime_error() -> None:
    """Verify calling process_message without redis client raises RuntimeError."""
    event = WorkoutCompletedEvent(
        event_type="workout.completed",
        workout_id=uuid4(),
        user_id=uuid4(),
        completed_at=datetime.now(UTC),
        metrics=BenchPressMetrics(
            exercise_type="bench_press",
            weight=100.0,
            sets=3,
            reps=10,
        ),
    )
    consumer = WorkoutEventConsumer(redis=None)
    with pytest.raises(RuntimeError, match="Redis client is not initialized"):
        await consumer.process_message(event)


# ==============================================================================
# 5. Consumer Lifecycle & Consumption Loop Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_consumer_start_and_stop_lifecycle() -> None:
    """Verify consumer start and stop methods manage resources cleanly."""
    mock_kafka = AsyncMock(spec=AIOKafkaConsumer)
    mock_kafka.start = AsyncMock()
    mock_kafka.stop = AsyncMock()

    mock_redis = AsyncMock(spec=Redis)
    mock_redis.aclose = AsyncMock()

    consumer = WorkoutEventConsumer(consumer=mock_kafka, redis=mock_redis)
    await consumer.start()
    assert consumer._running is True
    mock_kafka.start.assert_awaited_once()

    await consumer.stop()
    assert consumer._running is False
    mock_kafka.stop.assert_awaited_once()


@pytest.mark.asyncio
async def test_consumer_single_pass_consume() -> None:
    """Verify consume with stop_event=None runs single pass and processes records."""
    user_id = uuid4()
    workout_id = uuid4()
    payload = {
        "event_id": str(uuid4()),
        "event_type": "workout.completed",
        "workout_id": str(workout_id),
        "user_id": str(user_id),
        "completed_at": datetime.now(UTC).isoformat(),
        "occurred_at": datetime.now(UTC).isoformat(),
        "metrics": {
            "exercise_type": "bench_press",
            "weight": 100.0,
            "sets": 3,
            "reps": 10,
        },
    }
    raw_bytes = json.dumps(payload).encode("utf-8")
    record = MagicMock()
    record.value = raw_bytes

    mock_kafka = AsyncMock(spec=AIOKafkaConsumer)
    mock_kafka.getmany = AsyncMock(return_value={"partition-0": [record]})

    mock_redis = AsyncMock(spec=Redis)
    mock_redis.zincrby = AsyncMock(return_value=3000.0)

    consumer = WorkoutEventConsumer(consumer=mock_kafka, redis=mock_redis)
    await consumer.start()
    await consumer.consume(stop_event=None)

    mock_kafka.getmany.assert_awaited_once()
    mock_redis.zincrby.assert_awaited_once_with(
        name="leaderboard:tonnage",
        amount=3000.0,
        value=str(user_id),
    )
    await consumer.stop()


@pytest.mark.asyncio
async def test_consumer_loop_stops_on_event() -> None:
    """Verify consume loop terminates gracefully when stop_event is set."""
    mock_kafka = AsyncMock(spec=AIOKafkaConsumer)
    mock_kafka.getmany = AsyncMock(return_value={})

    mock_redis = AsyncMock(spec=Redis)
    consumer = WorkoutEventConsumer(consumer=mock_kafka, redis=mock_redis)
    await consumer.start()

    stop_event = asyncio.Event()
    loop_task = asyncio.create_task(consumer.consume(stop_event=stop_event))

    await asyncio.sleep(0.02)
    stop_event.set()
    await loop_task

    assert loop_task.done()
    await consumer.stop()


@pytest.mark.asyncio
async def test_consumer_loop_cancellation_handled() -> None:
    """Verify consumer task cancellation is caught gracefully."""
    mock_kafka = AsyncMock(spec=AIOKafkaConsumer)
    mock_kafka.getmany = AsyncMock(return_value={})

    mock_redis = AsyncMock(spec=Redis)
    consumer = WorkoutEventConsumer(consumer=mock_kafka, redis=mock_redis)
    await consumer.start()

    stop_event = asyncio.Event()
    task = asyncio.create_task(consumer.consume(stop_event=stop_event))

    await asyncio.sleep(0.01)
    task.cancel()
    await task

    assert task.done()
    await consumer.stop()


@pytest.mark.asyncio
async def test_consumer_consume_without_started_consumer_raises() -> None:
    """Verify consume without initialized consumer raises RuntimeError."""
    consumer = WorkoutEventConsumer()
    with pytest.raises(RuntimeError, match="Kafka consumer is not initialized or started"):
        await consumer.consume()


# ==============================================================================
# 6. Autonomous Worker Tests (leaderboard_service/src/worker.py)
# ==============================================================================


def test_worker_get_service_status() -> None:
    """Verify worker returns valid health and service status dictionary."""
    status = get_service_status()
    assert status == {"status": "ok", "service": "leaderboard_consumer_worker"}


@pytest.mark.asyncio
async def test_run_worker_lifecycle_with_stop_event() -> None:
    """Verify run_worker initializes, consumes, and stops injected consumer."""
    mock_consumer = AsyncMock(spec=WorkoutEventConsumer)
    mock_consumer.start = AsyncMock()
    mock_consumer.consume = AsyncMock()
    mock_consumer.stop = AsyncMock()

    stop_event = asyncio.Event()
    stop_event.set()

    await run_worker(stop_event=stop_event, consumer=mock_consumer)

    mock_consumer.start.assert_awaited_once()
    mock_consumer.consume.assert_awaited_once_with(stop_event=stop_event)
    mock_consumer.stop.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_worker_single_pass() -> None:
    """Verify run_worker single-pass execution when stop_event is None."""
    mock_consumer = AsyncMock(spec=WorkoutEventConsumer)
    mock_consumer.start = AsyncMock()
    mock_consumer.consume = AsyncMock()
    mock_consumer.stop = AsyncMock()

    await run_worker(stop_event=None, consumer=mock_consumer)

    mock_consumer.start.assert_awaited_once()
    mock_consumer.consume.assert_awaited_once_with(stop_event=None)
    mock_consumer.stop.assert_awaited_once()


# ==============================================================================
# 7. Lifespan Integration Tests (leaderboard_service/src/main.py)
# ==============================================================================


@pytest.mark.asyncio
async def test_lifespan_kafka_consumer_enabled() -> None:
    """Verify lifespan starts and stops WorkoutEventConsumer when enable_kafka_consumer is True."""
    with (
        patch(
            "leaderboard_service.src.main.init_redis_pool", new_callable=AsyncMock
        ) as mock_init_pool,
        patch(
            "leaderboard_service.src.main.close_redis_pool", new_callable=AsyncMock
        ) as mock_close_pool,
        patch("leaderboard_service.src.main.settings.enable_kafka_consumer", True),
        patch("leaderboard_service.src.main.WorkoutEventConsumer") as mock_consumer_cls,
    ):
        mock_instance = AsyncMock(spec=WorkoutEventConsumer)
        mock_instance.start = AsyncMock()
        mock_instance.consume = AsyncMock()
        mock_instance.stop = AsyncMock()
        mock_consumer_cls.return_value = mock_instance

        async with lifespan(app):
            mock_init_pool.assert_awaited_once()
            mock_instance.start.assert_awaited_once()

        mock_instance.stop.assert_awaited_once()
        mock_close_pool.assert_awaited_once()


@pytest.mark.asyncio
async def test_lifespan_kafka_consumer_disabled_by_default() -> None:
    """Verify lifespan does not start WorkoutEventConsumer when enable_kafka_consumer is False."""
    with (
        patch("leaderboard_service.src.main.init_redis_pool", new_callable=AsyncMock),
        patch("leaderboard_service.src.main.close_redis_pool", new_callable=AsyncMock),
        patch("leaderboard_service.src.main.settings.enable_kafka_consumer", False),
        patch("leaderboard_service.src.main.WorkoutEventConsumer") as mock_consumer_cls,
    ):
        async with lifespan(app):
            pass

        mock_consumer_cls.assert_not_called()


# ==============================================================================
# 8. Configuration & Settings Tests (KafkaSettings & Settings)
# ==============================================================================


def test_kafka_settings_defaults() -> None:
    """Verify KafkaSettings default configuration values."""
    kafka_cfg = KafkaSettings()
    assert kafka_cfg.kafka_bootstrap_servers == "localhost:9092"
    assert kafka_cfg.kafka_consumer_group == "leaderboard-service-group"
    assert kafka_cfg.kafka_workout_topic == "workout.events"
    assert kafka_cfg.enable_kafka_consumer is False

    assert kafka_cfg.KAFKA_BOOTSTRAP_SERVERS == "localhost:9092"
    assert kafka_cfg.KAFKA_CONSUMER_GROUP == "leaderboard-service-group"
    assert kafka_cfg.KAFKA_WORKOUT_TOPIC == "workout.events"
    assert kafka_cfg.ENABLE_KAFKA_CONSUMER is False


def test_settings_kafka_properties() -> None:
    """Verify Settings includes Kafka and Leaderboard configuration with property accessors."""
    custom_settings = Settings(
        kafka_bootstrap_servers="kafka-broker:9092",
        kafka_consumer_group="custom-group",
        kafka_workout_topic="custom.workouts",
        leaderboard_tonnage_key="leaderboard:all_time",
        enable_kafka_consumer=True,
    )
    assert custom_settings.KAFKA_BOOTSTRAP_SERVERS == "kafka-broker:9092"
    assert custom_settings.KAFKA_CONSUMER_GROUP == "custom-group"
    assert custom_settings.KAFKA_WORKOUT_TOPIC == "custom.workouts"
    assert custom_settings.LEADERBOARD_TONNAGE_KEY == "leaderboard:all_time"
    assert custom_settings.ENABLE_KAFKA_CONSUMER is True

    kafka_sub = custom_settings.kafka
    assert isinstance(kafka_sub, KafkaSettings)
    assert kafka_sub.kafka_bootstrap_servers == "kafka-broker:9092"
    assert kafka_sub.kafka_consumer_group == "custom-group"
    assert kafka_sub.kafka_workout_topic == "custom.workouts"
    assert kafka_sub.enable_kafka_consumer is True


# ==============================================================================
# 9. Monorepo & Architectural Standards Tests
# ==============================================================================


def test_all_leaderboard_modules_importable() -> None:
    """Verify all new modules and services can be imported cleanly."""
    from leaderboard_service.src.services.consumer import WorkoutEventConsumer as WEC
    from leaderboard_service.src.services.tonnage import (
        calculate_workout_tonnage as CWT,
        update_user_tonnage as UUT,
    )
    from leaderboard_service.src.worker import get_service_status as GSS, run_worker as RW

    assert WEC is not None
    assert CWT is not None
    assert UUT is not None
    assert GSS is not None
    assert RW is not None
