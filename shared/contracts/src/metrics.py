from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrengthExerciseMetrics(BaseModel):
    """Metrics schema for arbitrary strength exercises (e.g. overhead press, bicep curls)."""

    model_config = ConfigDict(extra="forbid")

    exercise_type: Literal["strength"] = "strength"
    exercise_name: str = Field(min_length=1, description="Name of the strength exercise")
    weight: float = Field(gt=0, description="Working weight in kg (must be greater than 0)")
    sets: int = Field(gt=0, description="Number of sets completed")
    reps: int = Field(gt=0, description="Number of repetitions per set")
    rpe: float | None = Field(
        default=None,
        ge=1,
        le=10,
        description="Rate of Perceived Exertion (scale 1-10)",
    )


class CardioExerciseMetrics(BaseModel):
    """Metrics schema for arbitrary cardio exercises (e.g. rowing, outdoor cycling)."""

    model_config = ConfigDict(extra="forbid")

    exercise_type: Literal["cardio"] = "cardio"
    exercise_name: str = Field(min_length=1, description="Name of the cardio exercise")
    distance_km: float = Field(gt=0, description="Covered distance in kilometers")
    duration_minutes: float = Field(gt=0, description="Duration of exercise in minutes")
    heart_rate: int | None = Field(
        default=None,
        gt=0,
        description="Average heart rate during exercise",
    )
    calories_burned: int | None = Field(
        default=None,
        gt=0,
        description="Estimated calories burned during exercise",
    )


class BenchPressMetrics(BaseModel):
    """Specialized metrics schema for bench press exercises."""

    model_config = ConfigDict(extra="forbid")

    exercise_type: Literal["bench_press", "benchpress"] = "bench_press"
    weight: float = Field(gt=0, description="Working weight in kg (must be greater than 0)")
    sets: int = Field(gt=0, description="Number of sets completed")
    reps: int = Field(gt=0, description="Number of repetitions per set")
    rpe: float | None = Field(
        default=None,
        ge=1,
        le=10,
        description="Rate of Perceived Exertion (scale 1-10)",
    )
    grip_width_cm: float | None = Field(
        default=None,
        gt=0,
        description="Grip width in centimeters",
    )


class SquatMetrics(BaseModel):
    """Specialized metrics schema for squat exercises."""

    model_config = ConfigDict(extra="forbid")

    exercise_type: Literal["squats", "squat"] = "squats"
    weight: float = Field(gt=0, description="Working weight in kg (must be greater than 0)")
    sets: int = Field(gt=0, description="Number of sets completed")
    reps: int = Field(gt=0, description="Number of repetitions per set")
    rpe: float | None = Field(
        default=None,
        ge=1,
        le=10,
        description="Rate of Perceived Exertion (scale 1-10)",
    )
    stance: Literal["narrow", "medium", "wide"] | None = Field(
        default=None,
        description="Squat stance width ('narrow', 'medium', 'wide')",
    )


SquatsMetrics = SquatMetrics


class DeadliftMetrics(BaseModel):
    """Specialized metrics schema for deadlift exercises."""

    model_config = ConfigDict(extra="forbid")

    exercise_type: Literal["deadlift"] = "deadlift"
    weight: float = Field(gt=0, description="Working weight in kg (must be greater than 0)")
    sets: int = Field(gt=0, description="Number of sets completed")
    reps: int = Field(gt=0, description="Number of repetitions per set")
    rpe: float | None = Field(
        default=None,
        ge=1,
        le=10,
        description="Rate of Perceived Exertion (scale 1-10)",
    )
    deadlift_style: Literal["conventional", "sumo"] | None = Field(
        default=None,
        description="Deadlift style ('conventional', 'sumo')",
    )


class TreadmillMetrics(BaseModel):
    """Specialized metrics schema for treadmill and running workouts."""

    model_config = ConfigDict(extra="forbid")

    exercise_type: Literal["treadmill", "running"] = "treadmill"
    distance_km: float = Field(gt=0, description="Covered distance in kilometers")
    duration_minutes: float = Field(gt=0, description="Duration of exercise in minutes")
    heart_rate: int | None = Field(
        default=None,
        gt=0,
        description="Average heart rate during exercise",
    )
    incline_percentage: float | None = Field(
        default=None,
        ge=0,
        le=40,
        description="Incline grade percentage (0-40%)",
    )
    speed_kmh: float | None = Field(
        default=None,
        gt=0,
        description="Running speed in kilometers per hour",
    )
    pace_min_per_km: float | None = Field(
        default=None,
        gt=0,
        description="Running pace in minutes per kilometer",
    )
    calories_burned: int | None = Field(
        default=None,
        gt=0,
        description="Estimated calories burned during exercise",
    )


RunningMetrics = TreadmillMetrics


WorkoutMetrics = Annotated[
    BenchPressMetrics
    | SquatMetrics
    | DeadliftMetrics
    | TreadmillMetrics
    | StrengthExerciseMetrics
    | CardioExerciseMetrics,
    Field(discriminator="exercise_type"),
]

__all__ = [
    "BenchPressMetrics",
    "CardioExerciseMetrics",
    "DeadliftMetrics",
    "RunningMetrics",
    "SquatMetrics",
    "SquatsMetrics",
    "StrengthExerciseMetrics",
    "TreadmillMetrics",
    "WorkoutMetrics",
]
