from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from shared.contracts.src import (
    BaseCommand,
    BaseEvent,
    BenchPressMetrics,
    CardioExerciseMetrics,
    DeadliftMetrics,
    RunningMetrics,
    SendAchievementNotificationCommand,
    SendNotificationCommand,
    SquatMetrics,
    SquatsMetrics,
    StrengthExerciseMetrics,
    TreadmillMetrics,
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
        calories_burned=320,
    )
    assert metrics.exercise_type == "cardio"
    assert metrics.distance_km == 5.25
    assert metrics.duration_minutes == 30.0
    assert metrics.heart_rate == 145
    assert metrics.calories_burned == 320

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


def test_bench_press_metrics_valid() -> None:
    """Verify valid bench press metrics creation and serialization."""
    metrics = BenchPressMetrics(
        weight=120.0,
        sets=4,
        reps=6,
        rpe=8.5,
        grip_width_cm=81.0,
    )
    assert metrics.exercise_type == "bench_press"
    assert metrics.weight == 120.0
    assert metrics.sets == 4
    assert metrics.reps == 6
    assert metrics.rpe == 8.5
    assert metrics.grip_width_cm == 81.0

    # Test alias tag 'benchpress'
    metrics_alias = BenchPressMetrics(
        exercise_type="benchpress",
        weight=100.0,
        sets=3,
        reps=8,
    )
    assert metrics_alias.exercise_type == "benchpress"

    data_json = metrics.model_dump_json()
    restored = BenchPressMetrics.model_validate_json(data_json)
    assert restored == metrics


@pytest.mark.parametrize(
    ("weight", "sets", "reps", "rpe", "grip_width_cm"),
    [
        (0.0, 3, 5, 8.0, 80.0),
        (-10.0, 3, 5, 8.0, 80.0),
        (100.0, 0, 5, 8.0, 80.0),
        (100.0, 3, 0, 8.0, 80.0),
        (100.0, 3, 5, 0.5, 80.0),
        (100.0, 3, 5, 10.5, 80.0),
        (100.0, 3, 5, 8.0, 0.0),
        (100.0, 3, 5, 8.0, -5.0),
    ],
)
def test_bench_press_metrics_invalid(
    weight: float,
    sets: int,
    reps: int,
    rpe: float,
    grip_width_cm: float,
) -> None:
    """Verify validation errors for bench press metrics."""
    with pytest.raises(ValidationError):
        BenchPressMetrics(
            weight=weight,
            sets=sets,
            reps=reps,
            rpe=rpe,
            grip_width_cm=grip_width_cm,
        )


def test_bench_press_metrics_extra_fields_forbidden() -> None:
    """Verify unexpected fields are rejected in bench press metrics."""
    with pytest.raises(ValidationError):
        BenchPressMetrics(
            weight=100.0,
            sets=3,
            reps=5,
            extra_field="rejected",  # type: ignore[call-arg]
        )


def test_squat_metrics_valid() -> None:
    """Verify valid squat metrics creation and serialization."""
    metrics = SquatMetrics(
        weight=150.0,
        sets=5,
        reps=5,
        rpe=9.0,
        stance="wide",
    )
    assert metrics.exercise_type == "squats"
    assert metrics.weight == 150.0
    assert metrics.stance == "wide"
    assert SquatsMetrics is SquatMetrics

    # Test alias tag 'squat' and stances
    valid_stances: tuple[Literal["narrow", "medium", "wide"] | None, ...] = (
        "narrow",
        "medium",
        "wide",
        None,
    )
    for stance in valid_stances:
        sm = SquatsMetrics(
            exercise_type="squat",
            weight=120.0,
            sets=3,
            reps=8,
            stance=stance,
        )
        assert sm.exercise_type == "squat"
        assert sm.stance == stance

    data_json = metrics.model_dump_json()
    restored = SquatMetrics.model_validate_json(data_json)
    assert restored == metrics


def test_squat_metrics_invalid_stance() -> None:
    """Verify invalid stance is rejected in squat metrics."""
    with pytest.raises(ValidationError):
        SquatMetrics(
            weight=100.0,
            sets=3,
            reps=5,
            stance="ultra_wide",  # type: ignore[arg-type]
        )


def test_squat_metrics_extra_fields_forbidden() -> None:
    """Verify unexpected fields are rejected in squat metrics."""
    with pytest.raises(ValidationError):
        SquatMetrics(
            weight=100.0,
            sets=3,
            reps=5,
            extra_field="rejected",  # type: ignore[call-arg]
        )


def test_deadlift_metrics_valid() -> None:
    """Verify valid deadlift metrics creation and serialization."""
    metrics = DeadliftMetrics(
        weight=200.0,
        sets=1,
        reps=5,
        rpe=9.5,
        deadlift_style="sumo",
    )
    assert metrics.exercise_type == "deadlift"
    assert metrics.weight == 200.0
    assert metrics.deadlift_style == "sumo"

    metrics_conv = DeadliftMetrics(
        weight=180.0,
        sets=3,
        reps=5,
        deadlift_style="conventional",
    )
    assert metrics_conv.deadlift_style == "conventional"

    data_json = metrics.model_dump_json()
    restored = DeadliftMetrics.model_validate_json(data_json)
    assert restored == metrics


def test_deadlift_metrics_invalid_style() -> None:
    """Verify invalid deadlift style is rejected."""
    with pytest.raises(ValidationError):
        DeadliftMetrics(
            weight=180.0,
            sets=3,
            reps=5,
            deadlift_style="romanian",  # type: ignore[arg-type]
        )


def test_deadlift_metrics_extra_fields_forbidden() -> None:
    """Verify unexpected fields are rejected in deadlift metrics."""
    with pytest.raises(ValidationError):
        DeadliftMetrics(
            weight=100.0,
            sets=3,
            reps=5,
            extra_field="rejected",  # type: ignore[call-arg]
        )


def test_treadmill_metrics_valid() -> None:
    """Verify valid treadmill metrics creation and serialization."""
    metrics = TreadmillMetrics(
        distance_km=7.5,
        duration_minutes=35.0,
        heart_rate=155,
        incline_percentage=3.0,
        speed_kmh=12.5,
        pace_min_per_km=4.8,
        calories_burned=420,
    )
    assert metrics.exercise_type == "treadmill"
    assert metrics.distance_km == 7.5
    assert metrics.duration_minutes == 35.0
    assert metrics.heart_rate == 155
    assert metrics.incline_percentage == 3.0
    assert metrics.speed_kmh == 12.5
    assert metrics.pace_min_per_km == 4.8
    assert metrics.calories_burned == 420
    assert RunningMetrics is TreadmillMetrics

    # Test alias tag 'running'
    metrics_run = RunningMetrics(
        exercise_type="running",
        distance_km=10.0,
        duration_minutes=50.0,
    )
    assert metrics_run.exercise_type == "running"

    data_json = metrics.model_dump_json()
    restored = TreadmillMetrics.model_validate_json(data_json)
    assert restored == metrics


@pytest.mark.parametrize(
    ("incline", "speed", "pace"),
    [
        (-1.0, 10.0, 5.0),  # incline < 0
        (41.0, 10.0, 5.0),  # incline > 40
        (2.0, 0.0, 5.0),  # speed <= 0
        (2.0, -5.0, 5.0),  # speed < 0
        (2.0, 10.0, 0.0),  # pace <= 0
        (2.0, 10.0, -1.0),  # pace < 0
    ],
)
def test_treadmill_metrics_invalid(
    incline: float,
    speed: float,
    pace: float,
) -> None:
    """Verify boundary and invalid values are rejected for treadmill metrics."""
    with pytest.raises(ValidationError):
        TreadmillMetrics(
            distance_km=5.0,
            duration_minutes=30.0,
            incline_percentage=incline,
            speed_kmh=speed,
            pace_min_per_km=pace,
        )


def test_treadmill_metrics_incline_boundaries() -> None:
    """Verify incline_percentage boundary values (0% and 40%)."""
    m0 = TreadmillMetrics(distance_km=5.0, duration_minutes=30.0, incline_percentage=0.0)
    assert m0.incline_percentage == 0.0

    m40 = TreadmillMetrics(distance_km=5.0, duration_minutes=30.0, incline_percentage=40.0)
    assert m40.incline_percentage == 40.0


def test_treadmill_metrics_extra_fields_forbidden() -> None:
    """Verify unexpected fields are rejected in treadmill metrics."""
    with pytest.raises(ValidationError):
        TreadmillMetrics(
            distance_km=5.0,
            duration_minutes=30.0,
            extra_field="rejected",  # type: ignore[call-arg]
        )


def test_discriminated_union_workout_metrics() -> None:
    """Verify Discriminated Union deserialization for WorkoutMetrics."""
    adapter: TypeAdapter[WorkoutMetrics] = TypeAdapter(WorkoutMetrics)

    # 1. StrengthExerciseMetrics
    parsed_strength = adapter.validate_python(
        {
            "exercise_type": "strength",
            "exercise_name": "deadlift",
            "weight": 180.0,
            "sets": 3,
            "reps": 3,
        }
    )
    assert isinstance(parsed_strength, StrengthExerciseMetrics)
    assert parsed_strength.weight == 180.0

    # 2. CardioExerciseMetrics
    parsed_cardio = adapter.validate_python(
        {
            "exercise_type": "cardio",
            "exercise_name": "rowing",
            "distance_km": 10.0,
            "duration_minutes": 55.0,
        }
    )
    assert isinstance(parsed_cardio, CardioExerciseMetrics)
    assert parsed_cardio.distance_km == 10.0

    # 3. BenchPressMetrics (tag: bench_press)
    parsed_bp = adapter.validate_python(
        {
            "exercise_type": "bench_press",
            "weight": 115.0,
            "sets": 4,
            "reps": 6,
            "grip_width_cm": 81.0,
        }
    )
    assert isinstance(parsed_bp, BenchPressMetrics)
    assert parsed_bp.grip_width_cm == 81.0

    # 4. BenchPressMetrics (tag: benchpress)
    parsed_bp_alias = adapter.validate_python(
        {
            "exercise_type": "benchpress",
            "weight": 90.0,
            "sets": 3,
            "reps": 10,
        }
    )
    assert isinstance(parsed_bp_alias, BenchPressMetrics)
    assert parsed_bp_alias.weight == 90.0

    # 5. SquatMetrics (tag: squats)
    parsed_sq = adapter.validate_python(
        {
            "exercise_type": "squats",
            "weight": 140.0,
            "sets": 5,
            "reps": 5,
            "stance": "wide",
        }
    )
    assert isinstance(parsed_sq, SquatMetrics)
    assert parsed_sq.stance == "wide"

    # 6. SquatMetrics (tag: squat)
    parsed_sq_alias = adapter.validate_python(
        {
            "exercise_type": "squat",
            "weight": 130.0,
            "sets": 3,
            "reps": 8,
            "stance": "narrow",
        }
    )
    assert isinstance(parsed_sq_alias, SquatMetrics)
    assert parsed_sq_alias.stance == "narrow"

    # 7. DeadliftMetrics (tag: deadlift)
    parsed_dl = adapter.validate_python(
        {
            "exercise_type": "deadlift",
            "weight": 190.0,
            "sets": 1,
            "reps": 5,
            "deadlift_style": "sumo",
        }
    )
    assert isinstance(parsed_dl, DeadliftMetrics)
    assert parsed_dl.deadlift_style == "sumo"

    # 8. TreadmillMetrics (tag: treadmill)
    parsed_tm = adapter.validate_python(
        {
            "exercise_type": "treadmill",
            "distance_km": 5.0,
            "duration_minutes": 25.0,
            "incline_percentage": 2.5,
        }
    )
    assert isinstance(parsed_tm, TreadmillMetrics)
    assert parsed_tm.incline_percentage == 2.5

    # 9. TreadmillMetrics (tag: running)
    parsed_run = adapter.validate_python(
        {
            "exercise_type": "running",
            "distance_km": 8.0,
            "duration_minutes": 42.0,
            "speed_kmh": 11.4,
        }
    )
    assert isinstance(parsed_run, TreadmillMetrics)
    assert parsed_run.speed_kmh == 11.4

    # Invalid discriminator value
    with pytest.raises(ValidationError):
        adapter.validate_python(
            {
                "exercise_type": "swimming",
                "exercise_name": "pool",
            }
        )


def test_workout_schemas_metrics_normalization() -> None:
    """Verify that 'exercise' field is normalized to 'exercise_type' for backward compatibility."""
    from workout_service.src.schemas.workout import (
        WorkoutBase,
        WorkoutCreate,
        WorkoutResponse,
        WorkoutUpdate,
    )

    # 1. WorkoutBase with legacy 'exercise' field
    wb = WorkoutBase.model_validate(
        {
            "type": "bench_press",
            "metrics": {
                "exercise": "bench_press",
                "weight": 110.0,
                "sets": 4,
                "reps": 6,
            },
        }
    )
    assert isinstance(wb.metrics, BenchPressMetrics)
    assert wb.metrics.exercise_type == "bench_press"
    assert wb.metrics.weight == 110.0

    # 2. WorkoutCreate with legacy 'exercise' field
    user_id = uuid4()
    wc = WorkoutCreate.model_validate(
        {
            "user_id": user_id,
            "type": "squat",
            "metrics": {
                "exercise": "squats",
                "weight": 150.0,
                "sets": 3,
                "reps": 5,
                "stance": "medium",
            },
        }
    )
    assert isinstance(wc.metrics, SquatMetrics)
    assert wc.metrics.exercise_type == "squats"
    assert wc.metrics.stance == "medium"

    # 3. WorkoutUpdate with legacy 'exercise' field
    wu = WorkoutUpdate.model_validate(
        {
            "metrics": {
                "exercise": "deadlift",
                "weight": 210.0,
                "sets": 1,
                "reps": 3,
                "deadlift_style": "conventional",
            },
        }
    )
    assert isinstance(wu.metrics, DeadliftMetrics)
    assert wu.metrics.exercise_type == "deadlift"

    # WorkoutUpdate with None metrics remains None
    wu_none = WorkoutUpdate(metrics=None)
    assert wu_none.metrics is None

    # 4. WorkoutResponse with legacy 'exercise' field
    now = datetime.now(UTC)
    wr = WorkoutResponse.model_validate(
        {
            "id": uuid4(),
            "user_id": user_id,
            "date": now,
            "type": "treadmill",
            "metrics": {
                "exercise": "treadmill",
                "distance_km": 5.0,
                "duration_minutes": 25.0,
                "incline_percentage": 2.0,
            },
            "created_at": now,
        }
    )
    assert isinstance(wr.metrics, TreadmillMetrics)
    assert wr.metrics.exercise_type == "treadmill"
    assert wr.metrics.incline_percentage == 2.0


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
        "BenchPressMetrics",
        "CardioExerciseMetrics",
        "DeadliftMetrics",
        "RunningMetrics",
        "SendAchievementNotificationCommand",
        "SendNotificationCommand",
        "SquatMetrics",
        "SquatsMetrics",
        "StrengthExerciseMetrics",
        "TreadmillMetrics",
        "WorkoutCompletedEvent",
        "WorkoutCreatedEvent",
        "WorkoutMetrics",
    }
    assert set(contracts_module.__all__) == expected_exports
    for export_name in expected_exports:
        assert hasattr(contracts_module, export_name)
