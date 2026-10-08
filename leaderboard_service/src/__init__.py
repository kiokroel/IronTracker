from __future__ import annotations

from leaderboard_service.src.core.config import (
    KafkaSettings,
    RedisSettings,
    Settings,
    get_settings,
    settings,
)
from leaderboard_service.src.core.redis import (
    close_redis_pool,
    get_redis,
    get_redis_client,
    get_redis_pool,
    init_redis_pool,
)
from leaderboard_service.src.main import app
from leaderboard_service.src.routes import router
from leaderboard_service.src.schemas.health import (
    HealthResponse,
    ReadyErrorResponse,
    ReadyResponse,
)
from leaderboard_service.src.services.consumer import WorkoutEventConsumer
from leaderboard_service.src.services.tonnage import (
    calculate_workout_tonnage,
    update_user_tonnage,
)
from leaderboard_service.src.worker import get_service_status, run_worker

__all__ = [
    "HealthResponse",
    "KafkaSettings",
    "ReadyErrorResponse",
    "ReadyResponse",
    "RedisSettings",
    "Settings",
    "WorkoutEventConsumer",
    "app",
    "calculate_workout_tonnage",
    "close_redis_pool",
    "get_redis",
    "get_redis_client",
    "get_redis_pool",
    "get_service_status",
    "get_settings",
    "init_redis_pool",
    "router",
    "run_worker",
    "settings",
    "update_user_tonnage",
]
