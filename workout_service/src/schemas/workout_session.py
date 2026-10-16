from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkoutSessionSet(BaseModel):
    """Single set within a session exercise."""

    set_number: int = Field(default=1, ge=1)
    weight: float = Field(default=0.0, ge=0.0)
    reps: int = Field(default=0, ge=0)
    rpe: float | None = Field(default=None, ge=1.0, le=10.0)
    is_warmup: bool = False


class WorkoutSessionExerciseItem(BaseModel):
    """Exercise entry inside a multi-exercise session."""

    exercise_id: UUID | None = None
    exercise_name: str = Field(min_length=1, max_length=255)
    exercise_type: Literal["strength", "cardio", "bodyweight"] = "strength"
    sets: list[WorkoutSessionSet] = Field(default_factory=list)
    distance_km: float | None = Field(default=None, ge=0.0)
    duration_minutes: float | None = Field(default=None, ge=0.0)
    heart_rate: int | None = Field(default=None, ge=30, le=250)
    calories_burned: int | None = Field(default=None, ge=0)
    notes: str | None = None


def calculate_session_tonnage(exercises: list[WorkoutSessionExerciseItem]) -> float:
    """Calculate total tonnage for working sets (excluding warmup) in a session."""
    total = 0.0
    for exercise in exercises:
        if exercise.exercise_type in ("strength", "bodyweight"):
            for s in exercise.sets:
                if not s.is_warmup and s.weight > 0 and s.reps > 0:
                    total += s.weight * s.reps
    return round(total, 2)


class WorkoutSessionBase(BaseModel):
    """Base schema for workout session."""

    title: str | None = Field(default=None, max_length=255)
    date: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    exercises: list[WorkoutSessionExerciseItem] = Field(default_factory=list)
    notes: str | None = None


class WorkoutSessionCreate(WorkoutSessionBase):
    """Schema for creating a workout session."""

    pass


class WorkoutSessionUpdate(BaseModel):
    """Schema for updating a workout session."""

    title: str | None = Field(default=None, max_length=255)
    date: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    exercises: list[WorkoutSessionExerciseItem] | None = None
    notes: str | None = None


class WorkoutSessionResponse(WorkoutSessionBase):
    """Response schema for a workout session."""

    id: UUID
    user_id: UUID
    total_tonnage: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


__all__ = [
    "WorkoutSessionSet",
    "WorkoutSessionExerciseItem",
    "WorkoutSessionBase",
    "WorkoutSessionCreate",
    "WorkoutSessionUpdate",
    "WorkoutSessionResponse",
    "calculate_session_tonnage",
]
