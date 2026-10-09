from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from analytics_service.src.core.config import Settings, get_settings
from analytics_service.src.core.database import (
    get_mongo_client as _get_mongo_client,
    get_mongo_database as _get_mongo_database,
)


def get_mongo_client() -> AsyncIOMotorClient[dict[str, Any]]:
    """Provide AsyncIOMotorClient singleton instance for dependency injection."""
    return _get_mongo_client()


def get_mongo_db() -> AsyncIOMotorDatabase[dict[str, Any]]:
    """Provide AsyncIOMotorDatabase instance for dependency injection."""
    return _get_mongo_database()


MongoClientDep = Annotated[AsyncIOMotorClient[dict[str, Any]], Depends(get_mongo_client)]
MongoDbDep = Annotated[AsyncIOMotorDatabase[dict[str, Any]], Depends(get_mongo_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]

__all__ = [
    "MongoClientDep",
    "MongoDbDep",
    "SettingsDep",
    "get_mongo_client",
    "get_mongo_db",
    "get_settings",
]
