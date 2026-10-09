from __future__ import annotations

from analytics_service.src.services.analytics import AnalyticsService
from analytics_service.src.services.calculator import (
    calculate_1rm_breakdown,
    calculate_average_1rm,
    calculate_brzycki_1rm,
    calculate_composite_1rm,
    calculate_epley_1rm,
    calculate_lander_1rm,
    calculate_lombardi_1rm,
    calculate_max_1rm,
    calculate_mayhew_1rm,
    calculate_o_conner_1rm,
    calculate_oconner_1rm,
    calculate_wathan_1rm,
    calculate_workout_tonnage,
    is_cardio_exercise,
    is_strength_exercise,
)
from analytics_service.src.services.consumer import AnalyticsEventConsumer

__all__ = [
    "AnalyticsEventConsumer",
    "AnalyticsService",
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
