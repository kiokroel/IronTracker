from __future__ import annotations

import logging
from typing import Any

import pymongo
from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorCollection,
    AsyncIOMotorDatabase,
)
from pymongo.errors import CollectionInvalid

from analytics_service.src.core.config import get_settings

logger = logging.getLogger(__name__)

# Global singleton client instance
_mongo_client: AsyncIOMotorClient[dict[str, Any]] | None = None


def get_mongo_client() -> AsyncIOMotorClient[dict[str, Any]]:
    """Return global AsyncIOMotorClient singleton, initializing lazily if needed."""
    global _mongo_client
    if _mongo_client is None:
        settings = get_settings()
        _mongo_client = AsyncIOMotorClient(
            settings.mongo_url,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
    return _mongo_client


def get_mongo_database(db_name: str | None = None) -> AsyncIOMotorDatabase[dict[str, Any]]:
    """Return AsyncIOMotorDatabase instance using default or specified database name."""
    client = get_mongo_client()
    target_db = db_name or get_settings().mongo.db
    return client[target_db]


async def init_mongo_client(uri: str | None = None) -> AsyncIOMotorClient[dict[str, Any]]:
    """Initialize AsyncIOMotorClient connection and verify connectivity via ping."""
    global _mongo_client
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None

    connection_uri = uri or get_settings().mongo_url
    client: AsyncIOMotorClient[dict[str, Any]] = AsyncIOMotorClient(
        connection_uri,
        serverSelectionTimeoutMS=3000,
        connectTimeoutMS=3000,
    )
    _mongo_client = client

    try:
        await client.admin.command("ping")
        logger.info("MongoDB connection pool initialized and ping successful")
    except Exception as exc:
        logger.warning(
            "MongoDB ping failed during initialization (service may still start): %s",
            exc,
        )

    return _mongo_client


async def close_mongo_client() -> None:
    """Gracefully close global AsyncIOMotorClient connection pool."""
    global _mongo_client
    if _mongo_client is not None:
        logger.info("Closing MongoDB client connection pool")
        _mongo_client.close()
        _mongo_client = None


async def ensure_timeseries_collection(
    db: AsyncIOMotorDatabase[dict[str, Any]] | None = None,
    collection_name: str | None = None,
) -> AsyncIOMotorCollection[dict[str, Any]]:
    """Verify or create MongoDB Time Series collection with proper compound index.

    Ensures collection is created with:
    - timeField: timestamp
    - metaField: metadata
    - granularity: seconds
    And compound index on (metadata.user_id, timestamp).
    """
    settings = get_settings()
    target_db = db if db is not None else get_mongo_database()
    col_name = collection_name or settings.mongo.collection_name

    existing_collections = await target_db.list_collection_names()

    if col_name not in existing_collections:
        timeseries_config: dict[str, str] = {
            "timeField": settings.mongo.time_field,
            "metaField": settings.mongo.meta_field,
            "granularity": settings.mongo.granularity,
        }
        try:
            logger.info(
                "Creating Time Series collection '%s' with parameters %s",
                col_name,
                timeseries_config,
            )
            await target_db.create_collection(
                col_name,
                timeseries=timeseries_config,
            )
        except CollectionInvalid:
            logger.info("Collection '%s' already created concurrently", col_name)
        except Exception as exc:
            logger.warning("Failed to create timeseries collection '%s': %s", col_name, exc)

    col: AsyncIOMotorCollection[dict[str, Any]] = target_db[col_name]

    # Create index on user_id inside metadata and timestamp for fast analytical queries
    try:
        meta_user_field = f"{settings.mongo.meta_field}.user_id"
        time_field = settings.mongo.time_field
        index_spec = [
            (meta_user_field, pymongo.ASCENDING),
            (time_field, pymongo.DESCENDING),
        ]
        await col.create_index(index_spec, name="idx_user_timestamp")
        logger.info(
            "Compound index on ('%s', '%s') ensured for '%s'",
            meta_user_field,
            time_field,
            col_name,
        )
    except Exception as exc:
        logger.warning("Could not ensure compound index on '%s': %s", col_name, exc)

    return col


__all__ = [
    "close_mongo_client",
    "ensure_timeseries_collection",
    "get_mongo_client",
    "get_mongo_database",
    "init_mongo_client",
]
