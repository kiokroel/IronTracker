from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CategoryType = Literal["strength", "cardio", "bodyweight"]
MuscleGroupType = Literal["chest", "back", "legs", "shoulders", "arms", "core", "full_body"]
EquipmentType = Literal["barbell", "dumbbell", "machine", "cable", "bodyweight", "other"]


class ExerciseBase(BaseModel):
    """Base schema for exercise attributes."""

    name: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Exercise title or name",
    )
    category: CategoryType = Field(
        default="strength",
        description="Exercise category (strength, cardio, bodyweight)",
    )
    target_muscle_groups: list[MuscleGroupType] = Field(
        default_factory=list,
        description="Target muscle groups involved in movement",
    )
    equipment: EquipmentType = Field(
        default="other",
        description="Equipment needed for execution",
    )


class ExerciseCreate(ExerciseBase):
    """Schema for creating a new custom exercise."""


class ExerciseUpdate(BaseModel):
    """Schema for updating custom exercise attributes."""

    name: str | None = Field(
        None,
        min_length=2,
        max_length=150,
        description="Updated exercise title",
    )
    category: CategoryType | None = None
    target_muscle_groups: list[MuscleGroupType] | None = None
    equipment: EquipmentType | None = None


class ExerciseResponse(ExerciseBase):
    """Schema representing an exercise in API responses."""

    id: uuid.UUID = Field(..., description="Unique exercise identifier")
    user_id: uuid.UUID | None = Field(
        None,
        description="User UUID for custom exercises, or null for default system exercises",
    )
    is_custom: bool = Field(
        default=False,
        description="Flag indicating if the exercise is user-defined",
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp when the exercise was registered",
    )

    model_config = ConfigDict(from_attributes=True)


__all__ = [
    "CategoryType",
    "EquipmentType",
    "ExerciseBase",
    "ExerciseCreate",
    "ExerciseResponse",
    "ExerciseUpdate",
    "MuscleGroupType",
]
