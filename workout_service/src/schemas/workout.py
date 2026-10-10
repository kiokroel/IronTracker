from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from shared.contracts.src.metrics import (
    BenchPressMetrics,
    CardioExerciseMetrics,
    DeadliftMetrics,
    RunningMetrics,
    SquatMetrics,
    SquatsMetrics,
    StrengthExerciseMetrics,
    TreadmillMetrics,
    WorkoutMetrics,
)


def _normalize_exercise_metrics(value: Any) -> Any:
    """Normalize legacy 'exercise' field to 'exercise_type' for backward compatibility."""
    if isinstance(value, dict) and "exercise" in value and "exercise_type" not in value:
        value = dict(value)
        value["exercise_type"] = value.pop("exercise")
    return value


class WorkoutBase(BaseModel):
    """Base schema for workout data."""

    model_config = ConfigDict(extra="forbid")

    type: str = Field(min_length=1, max_length=50, description="Type/category of workout")
    metrics: WorkoutMetrics = Field(
        description="Exercise metrics validated via Discriminated Union",
    )
    date: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Date and time when the workout took place in UTC",
    )

    @field_validator("metrics", mode="before")
    @classmethod
    def normalize_metrics(cls, value: Any) -> Any:
        return _normalize_exercise_metrics(value)


class WorkoutCreate(WorkoutBase):
    """Schema for creating a new workout entry."""

    user_id: UUID | None = Field(
        default=None,
        description="UUID of the user performing the workout (optional if authenticated)",
    )


class WorkoutUpdate(BaseModel):
    """Schema for updating an existing workout entry."""

    model_config = ConfigDict(extra="forbid")

    type: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
        description="Updated workout type/category",
    )
    metrics: WorkoutMetrics | None = Field(
        default=None,
        description="Updated exercise metrics validated via Discriminated Union",
    )
    date: datetime | None = Field(
        default=None,
        description="Updated date and time in UTC",
    )

    @field_validator("metrics", mode="before")
    @classmethod
    def normalize_metrics(cls, value: Any) -> Any:
        return _normalize_exercise_metrics(value)


class WorkoutResponse(BaseModel):
    """Schema for returning workout details in API responses."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID = Field(description="Unique workout identifier")
    user_id: UUID = Field(description="Identifier of the user")
    date: datetime = Field(description="Workout timestamp in UTC")
    type: str = Field(description="Workout type/category")
    metrics: WorkoutMetrics = Field(
        description="Exercise metrics validated via Discriminated Union",
    )
    created_at: datetime = Field(description="Record creation timestamp in UTC")

    @field_validator("metrics", mode="before")
    @classmethod
    def normalize_metrics(cls, value: Any) -> Any:
        return _normalize_exercise_metrics(value)


__all__ = [
    "BenchPressMetrics",
    "CardioExerciseMetrics",
    "DeadliftMetrics",
    "RunningMetrics",
    "SquatMetrics",
    "SquatsMetrics",
    "StrengthExerciseMetrics",
    "TreadmillMetrics",
    "WorkoutBase",
    "WorkoutCreate",
    "WorkoutMetrics",
    "WorkoutResponse",
    "WorkoutUpdate",
]
