from __future__ import annotations

import asyncio
import json
import math
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase

from analytics_service.src import (
    AnalyticsEventConsumer,
    AnalyticsRepository,
    AnalyticsService,
    OneRepMaxBreakdown,
    WorkoutTimeSeriesPoint,
    calculate_1rm_breakdown,
    calculate_average_1rm,
    calculate_brzycki_1rm,
    calculate_composite_1rm,
    calculate_epley_1rm,
    calculate_lander_1rm,
    calculate_lombardi_1rm,
    calculate_max_1rm,
    calculate_mayhew_1rm,
    calculate_o_conner_1rm,
    calculate_oconner_1rm,
    calculate_wathan_1rm,
    calculate_workout_tonnage,
    consume_events,
    is_cardio_exercise,
    is_strength_exercise,
    run_worker,
)
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
# 1. 1RM Calculator Formulas Unit Tests (Mathematical Correctness & Edge Cases)
# ==============================================================================


def test_epley_formula_reps_1_returns_weight() -> None:
    """Verify Epley formula returns exact weight when reps == 1."""
    assert calculate_epley_1rm(100.0, 1) == 100.0
    assert calculate_epley_1rm(250.5, 1) == 250.5


def test_epley_formula_reps_greater_than_1() -> None:
    """Verify Epley formula: weight * (1 + reps / 30)."""
    # 100 * (1 + 10 / 30) = 133.3333... -> 133.33
    assert calculate_epley_1rm(100.0, 10) == 133.33
    # 120 * (1 + 5 / 30) = 140.0
    assert calculate_epley_1rm(120.0, 5) == 140.0


def test_brzycki_formula_reps_1_returns_weight() -> None:
    """Verify Brzycki formula returns exact weight when reps == 1."""
    assert calculate_brzycki_1rm(100.0, 1) == 100.0


def test_brzycki_formula_reps_greater_than_1() -> None:
    """Verify Brzycki formula: weight * 36 / (37 - reps)."""
    # 100 * 36 / (37 - 5) = 3600 / 32 = 112.5
    assert calculate_brzycki_1rm(100.0, 5) == 112.5
    # 80 * 36 / (37 - 7) = 2880 / 30 = 96.0
    assert calculate_brzycki_1rm(80.0, 7) == 96.0


def test_brzycki_formula_invalid_reps_boundary() -> None:
    """Verify Brzycki formula raises ValueError when reps >= 37."""
    with pytest.raises(ValueError, match="reps >= 37"):
        calculate_brzycki_1rm(100.0, 37)
    with pytest.raises(ValueError, match="reps >= 37"):
        calculate_brzycki_1rm(100.0, 40)


def test_lander_formula_reps_1_returns_weight() -> None:
    """Verify Lander formula returns exact weight when reps == 1."""
    assert calculate_lander_1rm(100.0, 1) == 100.0


def test_lander_formula_reps_greater_than_1() -> None:
    """Verify Lander formula: (100 * weight) / (101.3 - 2.67123 * reps)."""
    # 100 * 100 / (101.3 - 2.67123 * 5) = 10000 / 87.94385 = 113.7089... -> 113.71
    assert calculate_lander_1rm(100.0, 5) == 113.71


def test_lander_formula_invalid_reps_boundary() -> None:
    """Verify Lander formula raises ValueError when denominator <= 0."""
    # 101.3 / 2.67123 ~ 37.92 -> reps = 38 causes denominator <= 0
    with pytest.raises(ValueError, match="denominator must be positive"):
        calculate_lander_1rm(100.0, 38)


def test_lombardi_formula_reps_1_returns_weight() -> None:
    """Verify Lombardi formula returns exact weight when reps == 1."""
    assert calculate_lombardi_1rm(100.0, 1) == 100.0


def test_lombardi_formula_reps_greater_than_1() -> None:
    """Verify Lombardi formula: weight * (reps ** 0.10)."""
    # 100 * (5 ** 0.10) = 100 * 1.1746189... = 117.46
    assert calculate_lombardi_1rm(100.0, 5) == 117.46


def test_mayhew_formula_reps_1_returns_weight() -> None:
    """Verify Mayhew formula returns exact weight when reps == 1."""
    assert calculate_mayhew_1rm(100.0, 1) == 100.0


def test_mayhew_formula_reps_greater_than_1() -> None:
    """Verify Mayhew formula: (100 * weight) / (52.2 + 41.9 * exp(-0.055 * reps))."""
    expected = round((100.0 * 100.0) / (52.2 + 41.9 * math.exp(-0.055 * 5)), 2)
    assert calculate_mayhew_1rm(100.0, 5) == expected
    assert calculate_mayhew_1rm(100.0, 5) == 119.01


def test_oconner_formula_reps_1_returns_weight() -> None:
    """Verify O'Conner formula returns exact weight when reps == 1."""
    assert calculate_oconner_1rm(100.0, 1) == 100.0
    assert calculate_o_conner_1rm(100.0, 1) == 100.0


def test_oconner_formula_reps_greater_than_1() -> None:
    """Verify O'Conner formula: weight * (1 + 0.025 * reps)."""
    # 100 * (1 + 0.025 * 5) = 100 * 1.125 = 112.5
    assert calculate_oconner_1rm(100.0, 5) == 112.5


def test_wathan_formula_reps_1_returns_weight() -> None:
    """Verify Wathan formula returns exact weight when reps == 1."""
    assert calculate_wathan_1rm(100.0, 1) == 100.0


def test_wathan_formula_reps_greater_than_1() -> None:
    """Verify Wathan formula: (100 * weight) / (48.8 + 53.8 * exp(-0.075 * reps))."""
    expected = round((100.0 * 100.0) / (48.8 + 53.8 * math.exp(-0.075 * 5)), 2)
    assert calculate_wathan_1rm(100.0, 5) == expected
    assert calculate_wathan_1rm(100.0, 5) == 116.58


def test_composite_and_average_1rm_reps_1_returns_weight() -> None:
    """Verify composite 1RM returns exact weight when reps == 1."""
    assert calculate_composite_1rm(150.0, 1) == 150.0
    assert calculate_average_1rm(150.0, 1) == 150.0


def test_composite_1rm_average_of_7_formulas() -> None:
    """Verify composite 1RM computes the arithmetic mean of all 7 formulas."""
    weight = 100.0
    reps = 5
    vals = [
        calculate_epley_1rm(weight, reps),
        calculate_brzycki_1rm(weight, reps),
        calculate_lander_1rm(weight, reps),
        calculate_lombardi_1rm(weight, reps),
        calculate_mayhew_1rm(weight, reps),
        calculate_oconner_1rm(weight, reps),
        calculate_wathan_1rm(weight, reps),
    ]
    expected_avg = round(sum(vals) / 7.0, 2)
    assert calculate_composite_1rm(weight, reps) == expected_avg
    assert calculate_average_1rm(weight, reps) == expected_avg


def test_heavy_weights_calculation() -> None:
    """Verify formula calculations handle heavy weights (500 kg) accurately."""
    heavy_weight = 500.0
    reps = 3
    epley = calculate_epley_1rm(heavy_weight, reps)
    assert epley == 550.0
    composite = calculate_composite_1rm(heavy_weight, reps)
    assert composite > heavy_weight


def test_invalid_values_raise_value_error() -> None:
    """Verify all formulas reject non-positive weight and reps with ValueError."""
    formulas = [
        calculate_epley_1rm,
        calculate_brzycki_1rm,
        calculate_lander_1rm,
        calculate_lombardi_1rm,
        calculate_mayhew_1rm,
        calculate_oconner_1rm,
        calculate_wathan_1rm,
        calculate_composite_1rm,
    ]
    for fn in formulas:
        with pytest.raises(ValueError, match="Weight must be greater than 0"):
            fn(-50.0, 5)
        with pytest.raises(ValueError, match="Weight must be greater than 0"):
            fn(0.0, 5)
        with pytest.raises(ValueError, match="Reps must be greater than 0"):
            fn(100.0, 0)
        with pytest.raises(ValueError, match="Reps must be greater than 0"):
            fn(100.0, -3)


def test_calculate_1rm_breakdown_structure() -> None:
    """Verify calculate_1rm_breakdown populates all 7 formulas and average."""
    breakdown = calculate_1rm_breakdown(100.0, 5)
    assert isinstance(breakdown, OneRepMaxBreakdown)
    assert breakdown.epley == 116.67
    assert breakdown.brzycki == 112.5
    assert breakdown.lander == 113.71
    assert breakdown.lombardi == 117.46
    assert breakdown.mayhew == 119.01
    assert breakdown.oconner == 112.5
    assert breakdown.o_conner == 112.5
    assert breakdown.wathan == 116.58
    assert breakdown.average == 115.49


def test_calculate_1rm_breakdown_reps_1() -> None:
    """Verify calculate_1rm_breakdown with reps=1 sets all formulas to weight."""
    breakdown = calculate_1rm_breakdown(120.0, 1)
    assert breakdown.epley == 120.0
    assert breakdown.brzycki == 120.0
    assert breakdown.lander == 120.0
    assert breakdown.lombardi == 120.0
    assert breakdown.mayhew == 120.0
    assert breakdown.oconner == 120.0
    assert breakdown.wathan == 120.0
    assert breakdown.average == 120.0


# ==============================================================================
# 2. Workout Metrics Tonnage & Direct Metric Ingestion Tests
# ==============================================================================


def test_calculate_1rm_from_strength_metrics_instances() -> None:
    """Verify 1RM calculation works when passing WorkoutMetrics instances directly."""
    bench = BenchPressMetrics(weight=100.0, sets=3, reps=10)
    assert calculate_epley_1rm(bench) == 133.33
    assert calculate_composite_1rm(bench) > 100.0

    squats = SquatMetrics(weight=140.0, sets=5, reps=5)
    assert calculate_epley_1rm(squats) == round(140.0 * (1 + 5 / 30), 2)

    deadlift = DeadliftMetrics(weight=180.0, sets=4, reps=4)
    assert calculate_epley_1rm(deadlift) == round(180.0 * (1 + 4 / 30), 2)

    strength = StrengthExerciseMetrics(exercise_name="overhead_press", weight=60.0, sets=3, reps=8)
    assert calculate_epley_1rm(strength) == round(60.0 * (1 + 8 / 30), 2)


def test_cardio_metrics_return_zero_or_handled_safely() -> None:
    """Verify cardio exercises return 0.0 for 1RM and 0.0 for tonnage."""
    cardio = CardioExerciseMetrics(exercise_name="rowing", distance_km=5.0, duration_minutes=25.0)
    assert calculate_epley_1rm(cardio) == 0.0
    assert calculate_composite_1rm(cardio) == 0.0
    assert calculate_workout_tonnage(cardio) == 0.0
    assert is_cardio_exercise(cardio) is True
    assert is_strength_exercise(cardio) is False

    treadmill = TreadmillMetrics(distance_km=10.0, duration_minutes=50.0)
    assert calculate_epley_1rm(treadmill) == 0.0
    assert calculate_composite_1rm(treadmill) == 0.0
    assert calculate_workout_tonnage(treadmill) == 0.0


def test_calculate_workout_tonnage_strength() -> None:
    """Verify tonnage calculation: weight * sets * reps."""
    bench = BenchPressMetrics(weight=100.0, sets=4, reps=10)
    assert calculate_workout_tonnage(bench) == 4000.0


def test_calculate_max_1rm_across_multiple_sets() -> None:
    """Verify calculate_max_1rm selects the highest 1RM from a series."""
    sets_data = [
        (100.0, 10),  # epley ~ 133.33
        (120.0, 5),  # epley = 140.0
        (140.0, 1),  # epley = 140.0
        (130.0, 3),  # epley = 143.0
    ]
    max_epley = calculate_max_1rm(sets_data, method="epley")
    assert max_epley == 143.0


# ==============================================================================
# 3. Pydantic Time Series Point & Document Creation Tests
# ==============================================================================


def test_point_from_event_strength_workout() -> None:
    """Verify WorkoutTimeSeriesPoint correctly creates document from strength event."""
    event = WorkoutCompletedEvent(
        workout_id=uuid4(),
        user_id=uuid4(),
        completed_at=datetime.now(UTC),
        metrics=BenchPressMetrics(weight=100.0, sets=3, reps=10, rpe=8.5),
    )
    point = WorkoutTimeSeriesPoint.from_event(event)

    assert point.metadata.user_id == str(event.user_id)
    assert point.metadata.workout_id == str(event.workout_id)
    assert point.metadata.exercise_type == "bench_press"
    assert point.metadata.rpe == 8.5

    assert point.tonnage == 3000.0
    assert point.weight == 100.0
    assert point.reps == 10
    assert point.sets == 3
    assert point.one_rep_max is not None
    assert point.one_rep_max > 100.0
    assert point.detailed_1rm is not None
    assert point.detailed_1rm.epley == 133.33

    doc = point.to_mongo_doc()
    assert doc["metadata"]["user_id"] == str(event.user_id)
    assert doc["tonnage"] == 3000.0
    assert doc["one_rep_max"] == point.one_rep_max
    assert "detailed_1rm" in doc
    assert doc["detailed_1rm"]["epley"] == 133.33


def test_point_from_event_cardio_workout() -> None:
    """Verify WorkoutTimeSeriesPoint correctly creates document from cardio event."""
    event = WorkoutCompletedEvent(
        workout_id=uuid4(),
        user_id=uuid4(),
        completed_at=datetime.now(UTC),
        metrics=CardioExerciseMetrics(
            exercise_name="cycling",
            distance_km=15.0,
            duration_minutes=45.0,
            heart_rate=140,
            calories_burned=450,
        ),
    )
    point = WorkoutTimeSeriesPoint.from_event(event)

    assert point.metadata.exercise_type == "cardio"
    assert point.metadata.exercise_name == "cycling"
    assert point.tonnage == 0.0
    assert point.one_rep_max is None
    assert point.detailed_1rm is None
    assert point.distance_km == 15.0
    assert point.duration_minutes == 45.0
    assert point.heart_rate == 140
    assert point.calories_burned == 450

    doc = point.to_mongo_doc()
    assert doc["metadata"]["exercise_type"] == "cardio"
    assert doc["tonnage"] == 0.0
    assert "one_rep_max" not in doc
    assert doc["distance_km"] == 15.0


# ==============================================================================
# 4. Analytics Repository & Service Integration Tests (Mocked Motor)
# ==============================================================================


@pytest.mark.asyncio
async def test_analytics_repository_save_point() -> None:
    """Verify AnalyticsRepository saves point into MongoDB collection."""
    mock_collection = AsyncMock(spec=AsyncIOMotorCollection)
    fake_inserted_id = "6706e2329b31d4576391456a"
    mock_insert_result = MagicMock()
    mock_insert_result.inserted_id = fake_inserted_id
    mock_collection.insert_one = AsyncMock(return_value=mock_insert_result)

    mock_db = MagicMock(spec=AsyncIOMotorDatabase)

    with patch(
        "analytics_service.src.repositories.analytics.ensure_timeseries_collection",
        new_callable=AsyncMock,
        return_value=mock_collection,
    ):
        repo = AnalyticsRepository(db=mock_db)
        event = WorkoutCompletedEvent(
            workout_id=uuid4(),
            user_id=uuid4(),
            completed_at=datetime.now(UTC),
            metrics=SquatMetrics(weight=150.0, sets=5, reps=5),
        )
        point = WorkoutTimeSeriesPoint.from_event(event)
        doc_id = await repo.save_point(point)

        assert doc_id == fake_inserted_id
        mock_collection.insert_one.assert_awaited_once()


@pytest.mark.asyncio
async def test_analytics_service_process_event() -> None:
    """Verify AnalyticsService handles WorkoutCompletedEvent and persists point."""
    mock_repo = MagicMock(spec=AnalyticsRepository)
    mock_repo.save_point = AsyncMock(return_value="mock_mongo_id_123")

    service = AnalyticsService(repository=mock_repo)

    event = WorkoutCompletedEvent(
        workout_id=uuid4(),
        user_id=uuid4(),
        completed_at=datetime.now(UTC),
        metrics=DeadliftMetrics(weight=200.0, sets=3, reps=3, deadlift_style="conventional"),
    )

    point = await service.process_workout_completed_event(event)

    assert point.id == "mock_mongo_id_123"
    assert point.metadata.exercise_type == "deadlift"
    assert point.tonnage == 1800.0
    mock_repo.save_point.assert_awaited_once()


# ==============================================================================
# 5. Kafka AnalyticsEventConsumer Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_consumer_process_message_bytes() -> None:
    """Verify consumer processes raw bytes JSON containing WorkoutCompletedEvent."""
    user_id = uuid4()
    workout_id = uuid4()
    completed_at = datetime.now(UTC)

    payload_dict = {
        "event_id": str(uuid4()),
        "event_type": "workout.completed",
        "occurred_at": completed_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "workout_id": str(workout_id),
        "user_id": str(user_id),
        "metrics": {
            "exercise_type": "bench_press",
            "weight": 100.0,
            "sets": 3,
            "reps": 10,
        },
    }
    raw_bytes = json.dumps(payload_dict).encode("utf-8")

    mock_service = MagicMock(spec=AnalyticsService)
    mock_point = MagicMock(spec=WorkoutTimeSeriesPoint)
    mock_service.process_workout_completed_event = AsyncMock(return_value=mock_point)

    consumer = AnalyticsEventConsumer(analytics_service=mock_service)
    result = await consumer.process_message(raw_bytes)

    assert result is mock_point
    mock_service.process_workout_completed_event.assert_awaited_once()


@pytest.mark.asyncio
async def test_consumer_process_message_event_instance() -> None:
    """Verify consumer processes WorkoutCompletedEvent instance directly."""
    event = WorkoutCompletedEvent(
        workout_id=uuid4(),
        user_id=uuid4(),
        completed_at=datetime.now(UTC),
        metrics=StrengthExerciseMetrics(exercise_name="barbell_curl", weight=40.0, sets=3, reps=10),
    )

    mock_service = MagicMock(spec=AnalyticsService)
    mock_point = MagicMock(spec=WorkoutTimeSeriesPoint)
    mock_service.process_workout_completed_event = AsyncMock(return_value=mock_point)

    consumer = AnalyticsEventConsumer(analytics_service=mock_service)
    result = await consumer.process_message(event)

    assert result is mock_point
    mock_service.process_workout_completed_event.assert_awaited_once_with(event)


@pytest.mark.asyncio
async def test_consumer_ignores_wrong_event_type() -> None:
    """Verify consumer ignores events that are not 'workout.completed'."""
    mock_service = MagicMock(spec=AnalyticsService)
    mock_service.process_workout_completed_event = AsyncMock()

    consumer = AnalyticsEventConsumer(analytics_service=mock_service)

    # Simulating a workout.created event
    created_payload = {
        "event_id": str(uuid4()),
        "event_type": "workout.created",
        "occurred_at": datetime.now(UTC).isoformat(),
        "created_at": datetime.now(UTC).isoformat(),
        "workout_id": str(uuid4()),
        "user_id": str(uuid4()),
        "metrics": {"exercise_type": "bench_press", "weight": 100.0, "sets": 3, "reps": 10},
    }

    result = await consumer.process_message(created_payload)
    assert result is None
    mock_service.process_workout_completed_event.assert_not_called()


@pytest.mark.asyncio
async def test_consumer_handles_invalid_json_gracefully() -> None:
    """Verify consumer logs and returns None on malformed payload."""
    mock_service = MagicMock(spec=AnalyticsService)
    consumer = AnalyticsEventConsumer(analytics_service=mock_service)

    result = await consumer.process_message(b"invalid-not-json")
    assert result is None


@pytest.mark.asyncio
async def test_consumer_lifecycle_start_stop() -> None:
    """Verify consumer startup and graceful shutdown."""
    mock_kafka = AsyncMock()
    mock_kafka.start = AsyncMock()
    mock_kafka.stop = AsyncMock()

    mock_db = MagicMock(spec=AsyncIOMotorDatabase)
    mock_collection = AsyncMock(spec=AsyncIOMotorCollection)

    with patch(
        "analytics_service.src.repositories.analytics.ensure_timeseries_collection",
        new_callable=AsyncMock,
        return_value=mock_collection,
    ):
        consumer = AnalyticsEventConsumer(
            consumer=mock_kafka,
            database=mock_db,
        )

        await consumer.start()
        assert consumer._running is True
        mock_kafka.start.assert_awaited_once()

        await consumer.stop()
        assert consumer._running is False
        mock_kafka.stop.assert_awaited_once()


@pytest.mark.asyncio
async def test_consumer_consume_loop_with_getmany() -> None:
    """Verify consumer message processing via getmany poll loop."""
    mock_kafka = AsyncMock()
    mock_kafka.start = AsyncMock()
    mock_kafka.stop = AsyncMock()

    event = WorkoutCompletedEvent(
        workout_id=uuid4(),
        user_id=uuid4(),
        completed_at=datetime.now(UTC),
        metrics=BenchPressMetrics(weight=100.0, sets=3, reps=10),
    )
    fake_msg = MagicMock()
    fake_msg.value = event

    # Return messages on first call, empty on subsequent calls
    first_call = True

    async def fake_getmany(timeout_ms: int, max_records: int) -> dict[str, list[Any]]:
        nonlocal first_call
        if first_call:
            first_call = False
            return {"topic-partition": [fake_msg]}
        await asyncio.sleep(0.01)
        return {}

    mock_kafka.getmany = AsyncMock(side_effect=fake_getmany)

    mock_service = MagicMock(spec=AnalyticsService)
    mock_service.process_workout_completed_event = AsyncMock()

    consumer = AnalyticsEventConsumer(
        consumer=mock_kafka,
        analytics_service=mock_service,
    )
    consumer._running = True

    stop_event = asyncio.Event()

    task = asyncio.create_task(consumer.consume(stop_event=stop_event))
    await asyncio.sleep(0.03)
    stop_event.set()
    await task

    mock_service.process_workout_completed_event.assert_awaited_once()


# ==============================================================================
# 6. Worker Execution with Consumer Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_worker_consume_events_with_consumer() -> None:
    """Verify worker consume_events invokes consumer.consume."""
    mock_consumer = MagicMock(spec=AnalyticsEventConsumer)
    mock_consumer.consume = AsyncMock()

    stop_event = asyncio.Event()
    await consume_events(stop_event=stop_event, consumer=mock_consumer)

    mock_consumer.consume.assert_awaited_once_with(stop_event=stop_event)


@pytest.mark.asyncio
async def test_worker_run_worker_with_consumer() -> None:
    """Verify run_worker properly starts and stops injected consumer."""
    mock_consumer = MagicMock(spec=AnalyticsEventConsumer)
    mock_consumer.consume = AsyncMock()

    stop_event = asyncio.Event()

    with (
        patch("analytics_service.src.worker.init_mongo_client", new_callable=AsyncMock) as m_init,
        patch(
            "analytics_service.src.worker.ensure_timeseries_collection", new_callable=AsyncMock
        ) as m_col,
        patch("analytics_service.src.worker.close_mongo_client", new_callable=AsyncMock) as m_close,
    ):
        await run_worker(stop_event=stop_event, consumer=mock_consumer)

        m_init.assert_awaited_once()
        m_col.assert_awaited_once()
        mock_consumer.consume.assert_awaited_once_with(stop_event=stop_event)
        m_close.assert_awaited_once()
