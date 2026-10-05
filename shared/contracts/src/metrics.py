from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrengthExerciseMetrics(BaseModel):
    """Metrics schema for strength exercises (e.g. bench press, squats)."""

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
    """Metrics schema for cardio exercises (e.g. running, rowing)."""

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


WorkoutMetrics = Annotated[
    StrengthExerciseMetrics | CardioExerciseMetrics,
    Field(discriminator="exercise_type"),
]
