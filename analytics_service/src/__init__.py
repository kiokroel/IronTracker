from __future__ import annotations

from analytics_service.src.core.config import (
    MongoSettings,
    Settings,
    get_settings,
    settings,
)
from analytics_service.src.core.database import (
    close_mongo_client,
    ensure_timeseries_collection,
    get_mongo_client,
    get_mongo_database,
    init_mongo_client,
)
from analytics_service.src.dependencies import (
    MongoClientDep,
    MongoDbDep,
    SettingsDep,
    get_mongo_db,
)
from analytics_service.src.main import app
from analytics_service.src.repositories.analytics import AnalyticsRepository
from analytics_service.src.schemas.analytics import (
    OneRepMaxBreakdown,
    WorkoutMetadata,
    WorkoutTimeSeriesMetadata,
    WorkoutTimeSeriesPoint,
)
from analytics_service.src.schemas.health import (
    HealthResponse,
    ReadyErrorResponse,
    ReadyResponse,
)
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
from analytics_service.src.worker import (
    consume_events,
    get_service_status,
    run_worker,
)

__all__ = [
    "AnalyticsEventConsumer",
    "AnalyticsRepository",
    "AnalyticsService",
    "HealthResponse",
    "MongoClientDep",
    "MongoDbDep",
    "MongoSettings",
    "OneRepMaxBreakdown",
    "ReadyErrorResponse",
    "ReadyResponse",
    "Settings",
    "SettingsDep",
    "WorkoutMetadata",
    "WorkoutTimeSeriesMetadata",
    "WorkoutTimeSeriesPoint",
    "app",
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
    "close_mongo_client",
    "consume_events",
    "ensure_timeseries_collection",
    "get_mongo_client",
    "get_mongo_database",
    "get_mongo_db",
    "get_service_status",
    "get_settings",
    "init_mongo_client",
    "is_cardio_exercise",
    "is_strength_exercise",
    "run_worker",
    "settings",
]
