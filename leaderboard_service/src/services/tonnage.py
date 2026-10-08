from __future__ import annotations

import logging
from uuid import UUID

from redis.asyncio import Redis

from leaderboard_service.src.core.config import get_settings
from shared.contracts.src.metrics import (
    BenchPressMetrics,
    CardioExerciseMetrics,
    DeadliftMetrics,
    SquatMetrics,
    StrengthExerciseMetrics,
    TreadmillMetrics,
    WorkoutMetrics,
)

logger = logging.getLogger(__name__)


def calculate_workout_tonnage(metrics: WorkoutMetrics) -> float:
    """Calculate the total tonnage in kilograms lifted during a workout.

    Formula for strength exercises (bench_press, squats, deadlift, strength):
        tonnage = float(weight * sets * reps)

    Cardio exercises (treadmill, cardio) do not contribute to lifting tonnage:
        tonnage = 0.0
    """
    if isinstance(
        metrics,
        (BenchPressMetrics, SquatMetrics, DeadliftMetrics, StrengthExerciseMetrics),
    ):
        return float(metrics.weight * metrics.sets * metrics.reps)

    if isinstance(metrics, (CardioExerciseMetrics, TreadmillMetrics)):
        return 0.0

    exercise_type = getattr(metrics, "exercise_type", "")
    if exercise_type in ("bench_press", "benchpress", "squats", "squat", "deadlift", "strength"):
        weight = float(getattr(metrics, "weight", 0.0))
        sets = int(getattr(metrics, "sets", 0))
        reps = int(getattr(metrics, "reps", 0))
        return float(weight * sets * reps)

    if exercise_type in ("cardio", "treadmill", "running"):
        return 0.0

    # Duck-typing fallback for any custom strength exercise model
    if hasattr(metrics, "weight") and hasattr(metrics, "sets") and hasattr(metrics, "reps"):
        weight = float(metrics.weight)
        sets = int(metrics.sets)
        reps = int(metrics.reps)
        return float(weight * sets * reps)

    return 0.0


async def update_user_tonnage(
    redis: Redis,
    user_id: UUID,
    tonnage: float,
    leaderboard_key: str | None = None,
) -> float:
    """Atomically increment a user's total tonnage in Redis Sorted Set (ZSET).

    If tonnage <= 0, no Redis operation is executed and 0.0 is returned.
    If tonnage > 0, executes redis.zincrby and returns the updated user score.
    """
    if tonnage <= 0:
        return 0.0

    key = leaderboard_key or get_settings().leaderboard_tonnage_key
    new_score = await redis.zincrby(
        name=key,
        amount=tonnage,
        value=str(user_id),
    )
    return float(new_score) if new_score is not None else 0.0


__all__ = [
    "calculate_workout_tonnage",
    "update_user_tonnage",
]
