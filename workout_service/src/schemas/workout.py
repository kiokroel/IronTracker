from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from shared.contracts.src.metrics import (
    CardioExerciseMetrics,
    StrengthExerciseMetrics,
    WorkoutMetrics,
)


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


class WorkoutCreate(WorkoutBase):
    """Schema for creating a new workout entry."""

    user_id: UUID = Field(description="UUID of the user performing the workout")


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


__all__ = [
    "CardioExerciseMetrics",
    "StrengthExerciseMetrics",
    "WorkoutBase",
    "WorkoutCreate",
    "WorkoutMetrics",
    "WorkoutResponse",
    "WorkoutUpdate",
]
