from __future__ import annotations

import logging
import math
from collections.abc import Sequence
from typing import Any

from analytics_service.src.schemas.analytics import OneRepMaxBreakdown
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


def is_strength_exercise(metrics: Any) -> bool:
    """Return True if metrics correspond to a strength exercise."""
    if isinstance(
        metrics,
        (BenchPressMetrics, SquatMetrics, DeadliftMetrics, StrengthExerciseMetrics),
    ):
        return True
    exercise_type = getattr(metrics, "exercise_type", "")
    return exercise_type in (
        "bench_press",
        "benchpress",
        "squats",
        "squat",
        "deadlift",
        "strength",
    )


def is_cardio_exercise(metrics: Any) -> bool:
    """Return True if metrics correspond to a cardio exercise."""
    if isinstance(metrics, (CardioExerciseMetrics, TreadmillMetrics)):
        return True
    exercise_type = getattr(metrics, "exercise_type", "")
    return exercise_type in ("cardio", "treadmill", "running")


def _extract_weight_and_reps(
    weight_or_metrics: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> tuple[float, int] | None:
    """Extract and validate (weight, reps) from numeric arguments or WorkoutMetrics.

    Returns:
        tuple[float, int] if valid strength parameters.
        None if input corresponds to a cardio exercise.

    Raises:
        ValueError if weight <= 0, reps <= 0, or missing required values.
    """
    if isinstance(weight_or_metrics, (int, float)):
        if reps is None:
            raise ValueError("reps must be provided when weight is a numeric value")
        w = float(weight_or_metrics)
        r = int(reps)
    elif is_cardio_exercise(weight_or_metrics):
        return None
    elif isinstance(
        weight_or_metrics,
        (BenchPressMetrics, SquatMetrics, DeadliftMetrics, StrengthExerciseMetrics),
    ):
        w = float(weight_or_metrics.weight)
        r = int(weight_or_metrics.reps)
    elif isinstance(weight_or_metrics, dict) and "weight" in weight_or_metrics:
        if "reps" not in weight_or_metrics:
            raise ValueError("reps missing in metrics dictionary")
        w = float(weight_or_metrics["weight"])
        r = int(weight_or_metrics["reps"])
    elif hasattr(weight_or_metrics, "weight") and hasattr(weight_or_metrics, "reps"):
        w = float(weight_or_metrics.weight)
        r = int(weight_or_metrics.reps)
    else:
        raise ValueError(f"Cannot extract weight and reps from input: {type(weight_or_metrics)}")

    if w <= 0:
        raise ValueError(f"Weight must be greater than 0, got {w}")
    if r <= 0:
        raise ValueError(f"Reps must be greater than 0, got {r}")

    return w, r


def calculate_epley_1rm(
    weight: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> float:
    """Calculate 1RM using the Epley formula:

    1RM = weight * (1 + reps / 30)
    When reps == 1, 1RM = weight.
    For cardio workouts, returns 0.0.
    """
    extracted = _extract_weight_and_reps(weight, reps)
    if extracted is None:
        return 0.0
    w, r = extracted
    if r == 1:
        return round(w, 2)
    return round(float(w * (1.0 + r / 30.0)), 2)


def calculate_brzycki_1rm(
    weight: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> float:
    """Calculate 1RM using the Brzycki formula:

    1RM = weight * 36 / (37 - reps)
    When reps == 1, 1RM = weight.
    For reps >= 37, raises ValueError.
    For cardio workouts, returns 0.0.
    """
    extracted = _extract_weight_and_reps(weight, reps)
    if extracted is None:
        return 0.0
    w, r = extracted
    if r >= 37:
        raise ValueError(f"Brzycki formula is invalid for reps >= 37 (got {r})")
    if r == 1:
        return round(w, 2)
    return round(float(w * 36.0 / (37.0 - r)), 2)


def calculate_lander_1rm(
    weight: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> float:
    """Calculate 1RM using the Lander formula:

    1RM = (100 * weight) / (101.3 - 2.67123 * reps)
    When reps == 1, 1RM = weight.
    Raises ValueError if denominator <= 0.
    For cardio workouts, returns 0.0.
    """
    extracted = _extract_weight_and_reps(weight, reps)
    if extracted is None:
        return 0.0
    w, r = extracted
    if r == 1:
        return round(w, 2)
    denominator = 101.3 - 2.67123 * r
    if denominator <= 0:
        raise ValueError(
            f"Lander formula denominator must be positive (reps={r} resulted in {denominator})"
        )
    return round(float((100.0 * w) / denominator), 2)


def calculate_lombardi_1rm(
    weight: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> float:
    """Calculate 1RM using the Lombardi formula:

    1RM = weight * (reps ** 0.10)
    When reps == 1, 1RM = weight.
    For cardio workouts, returns 0.0.
    """
    extracted = _extract_weight_and_reps(weight, reps)
    if extracted is None:
        return 0.0
    w, r = extracted
    if r == 1:
        return round(w, 2)
    return round(float(w * (float(r) ** 0.10)), 2)


def calculate_mayhew_1rm(
    weight: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> float:
    """Calculate 1RM using the Mayhew formula:

    1RM = (100 * weight) / (52.2 + 41.9 * exp(-0.055 * reps))
    When reps == 1, 1RM = weight.
    For cardio workouts, returns 0.0.
    """
    extracted = _extract_weight_and_reps(weight, reps)
    if extracted is None:
        return 0.0
    w, r = extracted
    if r == 1:
        return round(w, 2)
    denominator = 52.2 + 41.9 * math.exp(-0.055 * r)
    return round(float((100.0 * w) / denominator), 2)


def calculate_oconner_1rm(
    weight: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> float:
    """Calculate 1RM using the O'Conner formula:

    1RM = weight * (1 + 0.025 * reps)
    When reps == 1, 1RM = weight.
    For cardio workouts, returns 0.0.
    """
    extracted = _extract_weight_and_reps(weight, reps)
    if extracted is None:
        return 0.0
    w, r = extracted
    if r == 1:
        return round(w, 2)
    return round(float(w * (1.0 + 0.025 * r)), 2)


# Alias for naming consistency
calculate_o_conner_1rm = calculate_oconner_1rm


def calculate_wathan_1rm(
    weight: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> float:
    """Calculate 1RM using the Wathan formula:

    1RM = (100 * weight) / (48.8 + 53.8 * exp(-0.075 * reps))
    When reps == 1, 1RM = weight.
    For cardio workouts, returns 0.0.
    """
    extracted = _extract_weight_and_reps(weight, reps)
    if extracted is None:
        return 0.0
    w, r = extracted
    if r == 1:
        return round(w, 2)
    denominator = 48.8 + 53.8 * math.exp(-0.075 * r)
    return round(float((100.0 * w) / denominator), 2)


def calculate_composite_1rm(
    weight: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> float:
    """Calculate composite 1RM as the arithmetic average of 7 scientific formulas.

    Formulas included: Epley, Brzycki, Lander, Lombardi, Mayhew, O'Conner, Wathan.
    When reps == 1, exactly returns the weight.
    For cardio workouts, returns 0.0.
    """
    extracted = _extract_weight_and_reps(weight, reps)
    if extracted is None:
        return 0.0
    w, r = extracted
    if r == 1:
        return round(w, 2)

    values = [
        calculate_epley_1rm(w, r),
        calculate_brzycki_1rm(w, r),
        calculate_lander_1rm(w, r),
        calculate_lombardi_1rm(w, r),
        calculate_mayhew_1rm(w, r),
        calculate_oconner_1rm(w, r),
        calculate_wathan_1rm(w, r),
    ]
    average = sum(values) / len(values)
    return round(average, 2)


# Alias for composite 1RM
calculate_average_1rm = calculate_composite_1rm


def calculate_1rm_breakdown(
    weight: float | WorkoutMetrics | Any,
    reps: int | None = None,
) -> OneRepMaxBreakdown:
    """Calculate 1RM across all 7 scientific formulas and return structured breakdown."""
    extracted = _extract_weight_and_reps(weight, reps)
    if extracted is None:
        return OneRepMaxBreakdown(
            epley=0.0,
            brzycki=0.0,
            lander=0.0,
            lombardi=0.0,
            mayhew=0.0,
            oconner=0.0,
            wathan=0.0,
            average=0.0,
        )
    w, r = extracted
    if r == 1:
        w_val = round(w, 2)
        return OneRepMaxBreakdown(
            epley=w_val,
            brzycki=w_val,
            lander=w_val,
            lombardi=w_val,
            mayhew=w_val,
            oconner=w_val,
            wathan=w_val,
            average=w_val,
        )

    epley = calculate_epley_1rm(w, r)
    brzycki = calculate_brzycki_1rm(w, r)
    lander = calculate_lander_1rm(w, r)
    lombardi = calculate_lombardi_1rm(w, r)
    mayhew = calculate_mayhew_1rm(w, r)
    oconner = calculate_oconner_1rm(w, r)
    wathan = calculate_wathan_1rm(w, r)

    all_vals = [epley, brzycki, lander, lombardi, mayhew, oconner, wathan]
    avg = round(sum(all_vals) / len(all_vals), 2)

    return OneRepMaxBreakdown(
        epley=epley,
        brzycki=brzycki,
        lander=lander,
        lombardi=lombardi,
        mayhew=mayhew,
        oconner=oconner,
        wathan=wathan,
        average=avg,
    )


def _calculate_detailed_tonnage(detailed_sets: list[Any]) -> float:
    """Calculate tonnage from detailed sets list, strictly ignoring warmup sets."""
    total = 0.0
    for s in detailed_sets:
        is_warmup = (
            s.get("is_warmup", False) if isinstance(s, dict) else getattr(s, "is_warmup", False)
        )
        if not is_warmup:
            w = float(s["weight"] if isinstance(s, dict) else getattr(s, "weight", 0.0))
            r = int(s["reps"] if isinstance(s, dict) else getattr(s, "reps", 0))
            total += w * r
    return float(total)


def calculate_workout_tonnage(metrics: WorkoutMetrics | Any) -> float:
    """Calculate total lifted tonnage in kg.

    For strength exercises:
        If metrics has non-empty detailed_sets:
            tonnage = sum(float(s.weight) * int(s.reps) for s in detailed_sets if not s.is_warmup)
        Otherwise:
            tonnage = float(weight * sets * reps)

    For cardio exercises:
        tonnage = 0.0
    """
    if isinstance(
        metrics,
        (BenchPressMetrics, SquatMetrics, DeadliftMetrics, StrengthExerciseMetrics),
    ):
        if metrics.detailed_sets:
            return float(
                sum(
                    float(s.weight) * int(s.reps)
                    for s in metrics.detailed_sets
                    if not getattr(s, "is_warmup", False)
                )
            )
        return float(metrics.weight * metrics.sets * metrics.reps)

    if isinstance(metrics, (CardioExerciseMetrics, TreadmillMetrics)):
        return 0.0

    exercise_type = ""
    if isinstance(metrics, dict):
        exercise_type = metrics.get("exercise_type", "")
    else:
        exercise_type = getattr(metrics, "exercise_type", "")

    if exercise_type in ("bench_press", "benchpress", "squats", "squat", "deadlift", "strength"):
        detailed = (
            metrics.get("detailed_sets")
            if isinstance(metrics, dict)
            else getattr(metrics, "detailed_sets", None)
        )
        if detailed:
            return _calculate_detailed_tonnage(detailed)
        weight = float(
            metrics.get("weight", 0.0)
            if isinstance(metrics, dict)
            else getattr(metrics, "weight", 0.0)
        )
        sets = int(
            metrics.get("sets", 0) if isinstance(metrics, dict) else getattr(metrics, "sets", 0)
        )
        reps = int(
            metrics.get("reps", 0) if isinstance(metrics, dict) else getattr(metrics, "reps", 0)
        )
        return float(weight * sets * reps)

    if exercise_type in ("cardio", "treadmill", "running"):
        return 0.0

    # Duck-typing fallback for any custom strength exercise model or dict
    detailed = (
        metrics.get("detailed_sets")
        if isinstance(metrics, dict)
        else getattr(metrics, "detailed_sets", None)
    )
    if detailed:
        return _calculate_detailed_tonnage(detailed)

    if hasattr(metrics, "weight") and hasattr(metrics, "sets") and hasattr(metrics, "reps"):
        return float(metrics.weight * metrics.sets * metrics.reps)

    if (
        isinstance(metrics, dict)
        and "weight" in metrics
        and "sets" in metrics
        and "reps" in metrics
    ):
        return float(metrics["weight"] * metrics["sets"] * metrics["reps"])

    return 0.0


def _extract_sets_from_item(item: Any) -> list[tuple[float, int, bool]] | None:
    """Extract list of (weight, reps, is_warmup) from an item if possible."""
    detailed = (
        item.get("detailed_sets")
        if isinstance(item, dict)
        else getattr(item, "detailed_sets", None)
    )
    if detailed:
        result: list[tuple[float, int, bool]] = []
        for s in detailed:
            w = float(s["weight"] if isinstance(s, dict) else getattr(s, "weight", 0.0))
            r = int(s["reps"] if isinstance(s, dict) else getattr(s, "reps", 0))
            warmup = bool(
                s.get("is_warmup", False) if isinstance(s, dict) else getattr(s, "is_warmup", False)
            )
            if w > 0 and r > 0:
                result.append((w, r, warmup))
        if result:
            return result

    if isinstance(item, tuple) and len(item) == 2:
        return [(float(item[0]), int(item[1]), False)]

    if isinstance(item, dict) and "weight" in item and "reps" in item:
        w = float(item["weight"])
        r = int(item["reps"])
        warmup = bool(item.get("is_warmup", False))
        if w > 0 and r > 0:
            return [(w, r, warmup)]

    if hasattr(item, "weight") and hasattr(item, "reps"):
        w = float(getattr(item, "weight", 0.0))
        r = int(getattr(item, "reps", 0))
        warmup = bool(getattr(item, "is_warmup", False))
        if w > 0 and r > 0:
            return [(w, r, warmup)]

    return None


def calculate_max_1rm(
    items: Sequence[Any] | Any,
    method: str = "composite",
) -> float:
    """Calculate maximum 1RM among multiple sets or exercises.

    Supports detailed_sets breakdown and warmup flags.
    """
    calc_fn = calculate_epley_1rm if method == "epley" else calculate_composite_1rm
    item_list: Sequence[Any] = [items] if not isinstance(items, (list, tuple)) else items

    extracted_sets: list[tuple[float, int, bool]] = []
    for item in item_list:
        try:
            if is_cardio_exercise(item):
                continue
            sets = _extract_sets_from_item(item)
            if sets:
                extracted_sets.extend(sets)
        except Exception as exc:
            logger.debug("Skipping item in max 1RM calculation: %s", exc)

    if not extracted_sets:
        return 0.0

    working_sets = [s for s in extracted_sets if not s[2]]
    candidate_sets = working_sets if len(working_sets) > 0 else extracted_sets

    max_val = 0.0
    for w, r, _ in candidate_sets:
        try:
            val = calc_fn(w, r)
            if val > max_val:
                max_val = val
        except Exception as exc:
            logger.debug("Error calculating 1RM for set (%s, %s): %s", w, r, exc)

    return max_val


__all__ = [
    "calculate_1rm_breakdown",
    "calculate_average_1rm",
    "calculate_brzycki_1rm",
    "calculate_composite_1rm",
    "calculate_epley_1rm",
    "calculate_lander_1rm",
    "calculate_lombardi_1rm",
    "calculate_max_1rm",
    "calculate_mayhew_1rm",
    "calculate_o_conner_1rm",
    "calculate_oconner_1rm",
    "calculate_wathan_1rm",
    "calculate_workout_tonnage",
    "is_cardio_exercise",
    "is_strength_exercise",
]
