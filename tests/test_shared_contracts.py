from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from shared.contracts.src import (
    BaseCommand,
    BaseEvent,
    CardioExerciseMetrics,
    SendAchievementNotificationCommand,
    SendNotificationCommand,
    StrengthExerciseMetrics,
    WorkoutCompletedEvent,
    WorkoutCreatedEvent,
    WorkoutMetrics,
)


def test_strength_exercise_metrics_valid() -> None:
    """Verify valid strength metrics creation and serialization."""
    metrics = StrengthExerciseMetrics(
        exercise_name="bench_press",
        weight=100.0,
        sets=5,
        reps=5,
        rpe=8.5,
    )
    assert metrics.exercise_type == "strength"
    assert metrics.exercise_name == "bench_press"
    assert metrics.weight == 100.0
    assert metrics.sets == 5
    assert metrics.reps == 5
    assert metrics.rpe == 8.5

    data_json = metrics.model_dump_json()
    restored = StrengthExerciseMetrics.model_validate_json(data_json)
    assert restored == metrics


@pytest.mark.parametrize(
    ("weight", "sets", "reps", "rpe"),
    [
        (0.0, 5, 5, 8.0),  # weight must be gt 0
        (-10.0, 5, 5, 8.0),  # weight negative
        (100.0, 0, 5, 8.0),  # sets must be gt 0
        (100.0, 5, 0, 8.0),  # reps must be gt 0
        (100.0, 5, 5, 0.5),  # rpe must be ge 1
        (100.0, 5, 5, 10.5),  # rpe must be le 10
    ],
)
def test_strength_exercise_metrics_invalid(
    weight: float,
    sets: int,
    reps: int,
    rpe: float,
) -> None:
    """Verify validation errors on boundary/invalid values for strength metrics."""
    with pytest.raises(ValidationError):
        StrengthExerciseMetrics(
            exercise_name="squat",
            weight=weight,
            sets=sets,
            reps=reps,
            rpe=rpe,
        )


def test_strength_metrics_extra_fields_forbidden() -> None:
    """Verify that unexpected fields are rejected."""
    with pytest.raises(ValidationError):
        StrengthExerciseMetrics(
            exercise_name="squat",
            weight=100.0,
            sets=3,
            reps=5,
            extra_field="malicious_payload",  # type: ignore[call-arg]
        )


def test_cardio_exercise_metrics_valid() -> None:
    """Verify valid cardio metrics creation and serialization."""
    metrics = CardioExerciseMetrics(
        exercise_name="treadmill",
        distance_km=5.25,
        duration_minutes=30.0,
        heart_rate=145,
    )
    assert metrics.exercise_type == "cardio"
    assert metrics.distance_km == 5.25
    assert metrics.duration_minutes == 30.0
    assert metrics.heart_rate == 145

    data_json = metrics.model_dump_json()
    restored = CardioExerciseMetrics.model_validate_json(data_json)
    assert restored == metrics


@pytest.mark.parametrize(
    ("distance", "duration", "heart_rate"),
    [
        (0.0, 30.0, 140),  # distance <= 0
        (-1.0, 30.0, 140),  # distance < 0
        (5.0, 0.0, 140),  # duration <= 0
        (5.0, 30.0, 0),  # heart rate <= 0
    ],
)
def test_cardio_exercise_metrics_invalid(
    distance: float,
    duration: float,
    heart_rate: int,
) -> None:
    """Verify validation errors for cardio metrics."""
    with pytest.raises(ValidationError):
        CardioExerciseMetrics(
            exercise_name="rowing",
            distance_km=distance,
            duration_minutes=duration,
            heart_rate=heart_rate,
        )


def test_discriminated_union_workout_metrics() -> None:
    """Verify Discriminated Union deserialization for WorkoutMetrics."""
    adapter: TypeAdapter[WorkoutMetrics] = TypeAdapter(WorkoutMetrics)

    strength_data = {
        "exercise_type": "strength",
        "exercise_name": "deadlift",
        "weight": 180.0,
        "sets": 3,
        "reps": 3,
    }
    parsed_strength = adapter.validate_python(strength_data)
    assert isinstance(parsed_strength, StrengthExerciseMetrics)
    assert parsed_strength.weight == 180.0

    cardio_data = {
        "exercise_type": "cardio",
        "exercise_name": "running",
        "distance_km": 10.0,
        "duration_minutes": 55.0,
    }
    parsed_cardio = adapter.validate_python(cardio_data)
    assert isinstance(parsed_cardio, CardioExerciseMetrics)
    assert parsed_cardio.distance_km == 10.0

    # Invalid discriminator value
    with pytest.raises(ValidationError):
        adapter.validate_python(
            {
                "exercise_type": "swimming",
                "exercise_name": "pool",
            }
        )


def test_base_event_defaults() -> None:
    """Verify BaseEvent auto-generates event_id and occurred_at timestamp."""
    event = BaseEvent(event_type="test.event")
    assert isinstance(event.event_id, UUID)
    assert isinstance(event.occurred_at, datetime)
    assert event.event_type == "test.event"


def test_base_command_defaults() -> None:
    """Verify BaseCommand auto-generates command_id and created_at timestamp."""
    cmd = BaseCommand(command_type="test.command")
    assert isinstance(cmd.command_id, UUID)
    assert isinstance(cmd.created_at, datetime)
    assert cmd.command_type == "test.command"


def test_workout_completed_event_serialization() -> None:
    """Verify Kafka WorkoutCompletedEvent serialization and round-trip validation."""
    workout_id = uuid4()
    user_id = uuid4()
    now = datetime.now(UTC)

    event = WorkoutCompletedEvent(
        workout_id=workout_id,
        user_id=user_id,
        completed_at=now,
        metrics=StrengthExerciseMetrics(
            exercise_name="overhead_press",
            weight=60.0,
            sets=4,
            reps=6,
        ),
    )
    assert event.event_type == "workout.completed"

    json_str = event.model_dump_json()
    restored = WorkoutCompletedEvent.model_validate_json(json_str)

    assert restored.event_id == event.event_id
    assert restored.workout_id == workout_id
    assert restored.user_id == user_id
    assert isinstance(restored.metrics, StrengthExerciseMetrics)
    assert restored.metrics.exercise_name == "overhead_press"
    assert restored.metrics.weight == 60.0


def test_workout_created_event_serialization() -> None:
    """Verify Kafka WorkoutCreatedEvent serialization with cardio metrics."""
    workout_id = uuid4()
    user_id = uuid4()
    now = datetime.now(UTC)

    event = WorkoutCreatedEvent(
        workout_id=workout_id,
        user_id=user_id,
        created_at=now,
        metrics=CardioExerciseMetrics(
            exercise_name="cycling",
            distance_km=25.0,
            duration_minutes=60.0,
            heart_rate=135,
        ),
    )
    assert event.event_type == "workout.created"

    json_str = event.model_dump_json()
    restored = WorkoutCreatedEvent.model_validate_json(json_str)
    assert restored.workout_id == workout_id
    assert isinstance(restored.metrics, CardioExerciseMetrics)
    assert restored.metrics.distance_km == 25.0


def test_send_notification_command() -> None:
    """Verify RabbitMQ SendNotificationCommand contract."""
    user_id = uuid4()
    cmd = SendNotificationCommand(
        user_id=user_id,
        channel="email",
        title="Workout Logged",
        message="Your workout has been successfully saved!",
    )
    assert cmd.command_type == "notification.send"
    assert cmd.channel == "email"

    json_data = cmd.model_dump_json()
    restored = SendNotificationCommand.model_validate_json(json_data)
    assert restored.command_id == cmd.command_id
    assert restored.user_id == user_id
    assert restored.title == "Workout Logged"

    # Invalid channel must be rejected
    with pytest.raises(ValidationError):
        SendNotificationCommand(
            user_id=user_id,
            channel="sms",  # type: ignore[arg-type]
            title="Title",
            message="Msg",
        )


def test_send_achievement_notification_command() -> None:
    """Verify RabbitMQ SendAchievementNotificationCommand contract."""
    user_id = uuid4()
    cmd = SendAchievementNotificationCommand(
        user_id=user_id,
        achievement_code="BENCH_100KG",
        title="Achievement Unlocked!",
        message="Congratulations on lifting 100kg in bench press!",
    )
    assert cmd.command_type == "notification.achievement"
    assert cmd.achievement_code == "BENCH_100KG"

    json_data = cmd.model_dump_json()
    restored = SendAchievementNotificationCommand.model_validate_json(json_data)
    assert restored.achievement_code == "BENCH_100KG"


def test_shared_contracts_all_exports() -> None:
    """Verify all expected public models are present in shared.contracts."""
    import shared.contracts.src as contracts_module

    expected_exports = {
        "BaseCommand",
        "BaseEvent",
        "CardioExerciseMetrics",
        "SendAchievementNotificationCommand",
        "SendNotificationCommand",
        "StrengthExerciseMetrics",
        "WorkoutCompletedEvent",
        "WorkoutCreatedEvent",
        "WorkoutMetrics",
    }
    assert set(contracts_module.__all__) == expected_exports
    for export_name in expected_exports:
        assert hasattr(contracts_module, export_name)
