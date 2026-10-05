from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from shared.contracts.src.metrics import WorkoutMetrics


class BaseEvent(BaseModel):
    """Base event model for Kafka event contracts."""

    model_config = ConfigDict(extra="forbid")

    event_id: UUID = Field(default_factory=uuid4, description="Unique identifier of the event")
    occurred_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Timestamp when the event occurred in UTC",
    )
    event_type: str = Field(min_length=1, description="Event type identifier")


class WorkoutCompletedEvent(BaseEvent):
    """Kafka event published when a user completes a workout."""

    model_config = ConfigDict(extra="forbid")

    event_type: Literal["workout.completed"] = "workout.completed"
    workout_id: UUID = Field(description="Identifier of the completed workout")
    user_id: UUID = Field(description="Identifier of the user who completed the workout")
    completed_at: datetime = Field(description="Timestamp when the workout was finished")
    metrics: WorkoutMetrics = Field(description="Exercise metrics of the completed workout")


class WorkoutCreatedEvent(BaseEvent):
    """Kafka event published when a new workout is created."""

    model_config = ConfigDict(extra="forbid")

    event_type: Literal["workout.created"] = "workout.created"
    workout_id: UUID = Field(description="Identifier of the created workout")
    user_id: UUID = Field(description="Identifier of the user")
    created_at: datetime = Field(description="Timestamp when the workout was created")
    metrics: WorkoutMetrics = Field(description="Exercise metrics of the workout")
