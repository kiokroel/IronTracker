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
from analytics_service.src.schemas.health import (
    HealthResponse,
    ReadyErrorResponse,
    ReadyResponse,
)
from analytics_service.src.worker import (
    consume_events,
    get_service_status,
    run_worker,
)

__all__ = [
    "HealthResponse",
    "MongoClientDep",
    "MongoDbDep",
    "MongoSettings",
    "ReadyErrorResponse",
    "ReadyResponse",
    "Settings",
    "SettingsDep",
    "app",
    "close_mongo_client",
    "consume_events",
    "ensure_timeseries_collection",
    "get_mongo_client",
    "get_mongo_database",
    "get_mongo_db",
    "get_service_status",
    "get_settings",
    "init_mongo_client",
    "run_worker",
    "settings",
]
