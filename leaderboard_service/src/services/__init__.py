from __future__ import annotations

from leaderboard_service.src.services.consumer import WorkoutEventConsumer
from leaderboard_service.src.services.tonnage import (
    calculate_workout_tonnage,
    update_user_tonnage,
)

__all__ = [
    "WorkoutEventConsumer",
    "calculate_workout_tonnage",
    "update_user_tonnage",
]
