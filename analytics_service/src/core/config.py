from __future__ import annotations

from functools import lru_cache

from dotenv import find_dotenv, load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load environment variables from .env file if available
load_dotenv(find_dotenv(usecwd=True))


class MongoSettings(BaseSettings):
    """Configuration for MongoDB connection and Time Series parameters."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    host: str = Field(
        default="localhost",
        validation_alias=AliasChoices("MONGO_HOST", "mongo_host", "host"),
        description="MongoDB server hostname or IP address",
    )
    port: int = Field(
        default=27017,
        validation_alias=AliasChoices("MONGO_PORT", "mongo_port", "port"),
        description="MongoDB server port number",
    )
    user: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MONGO_USER", "mongo_user", "user"),
        description="MongoDB username for authentication",
    )
    password: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MONGO_PASSWORD", "mongo_password", "password"),
        description="MongoDB password for authentication",
    )
    db: str = Field(
        default="irontracker_analytics",
        validation_alias=AliasChoices("MONGO_DB", "mongo_db", "db"),
        description="MongoDB database name",
    )
    timeField: str = Field(
        default="timestamp",
        validation_alias=AliasChoices("MONGO_TIMESERIES_TIME_FIELD", "timeField", "time_field"),
        description="Field containing timestamp for Time Series collection",
    )
    metaField: str = Field(
        default="metadata",
        validation_alias=AliasChoices("MONGO_TIMESERIES_META_FIELD", "metaField", "meta_field"),
        description="Field containing metadata for Time Series collection",
    )
    granularity: str = Field(
        default="seconds",
        validation_alias=AliasChoices("MONGO_TIMESERIES_GRANULARITY", "granularity"),
        description="Granularity for Time Series collection (seconds, minutes, hours)",
    )
    collection_name: str = Field(
        default="workout_metrics",
        validation_alias=AliasChoices(
            "MONGO_COLLECTION_NAME", "mongo_collection_name", "collection_name"
        ),
        description="Default Time Series collection name",
    )
    auth_source: str = Field(
        default="admin",
        validation_alias=AliasChoices("MONGO_AUTH_SOURCE", "auth_source", "authSource"),
        description="MongoDB authentication database",
    )

    @property
    def mongo_url(self) -> str:
        """Construct async MongoDB connection URL."""
        if self.user and self.password:
            auth_suffix = f"?authSource={self.auth_source}" if self.auth_source else ""
            return f"mongodb://{self.user}:{self.password}@{self.host}:{self.port}/{self.db}{auth_suffix}"
        return f"mongodb://{self.host}:{self.port}/{self.db}"

    @property
    def time_field(self) -> str:
        """Snake_case alias for timeField."""
        return self.timeField

    @property
    def meta_field(self) -> str:
        """Snake_case alias for metaField."""
        return self.metaField

    @property
    def MONGO_HOST(self) -> str:
        """Uppercase accessor for Mongo host."""
        return self.host

    @property
    def MONGO_PORT(self) -> int:
        """Uppercase accessor for Mongo port."""
        return self.port

    @property
    def MONGO_USER(self) -> str | None:
        """Uppercase accessor for Mongo user."""
        return self.user

    @property
    def MONGO_PASSWORD(self) -> str | None:
        """Uppercase accessor for Mongo password."""
        return self.password

    @property
    def MONGO_DB(self) -> str:
        """Uppercase accessor for Mongo database name."""
        return self.db

    @property
    def MONGO_URL(self) -> str:
        """Uppercase accessor for Mongo connection URL."""
        return self.mongo_url

    @property
    def MONGO_URI(self) -> str:
        """Uppercase accessor for Mongo connection URI (alias of MONGO_URL)."""
        return self.mongo_url

    @property
    def mongo_uri(self) -> str:
        """Lowercase alias for mongo_url."""
        return self.mongo_url

    @property
    def TIME_FIELD(self) -> str:
        """Uppercase accessor for timeField."""
        return self.timeField

    @property
    def META_FIELD(self) -> str:
        """Uppercase accessor for metaField."""
        return self.metaField

    @property
    def GRANULARITY(self) -> str:
        """Uppercase accessor for granularity."""
        return self.granularity


class Settings(BaseSettings):
    """Analytics Service application configuration with safe defaults."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = Field(
        default="IronTracker Analytics Service",
        validation_alias=AliasChoices("APP_NAME", "app_name"),
        description="Application display name",
    )
    debug: bool = Field(
        default=False,
        validation_alias=AliasChoices("DEBUG", "debug"),
        description="Enable debug mode",
    )
    app_host: str = Field(
        default="127.0.0.1",
        validation_alias=AliasChoices("APP_HOST", "app_host"),
        description="HTTP server host address",
    )
    app_port: int = Field(
        default=8003,
        validation_alias=AliasChoices("APP_PORT", "app_port"),
        description="HTTP server port",
    )

    # MongoDB connection parameters
    mongo_host: str = Field(
        default="localhost",
        validation_alias=AliasChoices("MONGO_HOST", "mongo_host", "host"),
        description="MongoDB server hostname or IP address",
    )
    mongo_port: int = Field(
        default=27017,
        validation_alias=AliasChoices("MONGO_PORT", "mongo_port", "port"),
        description="MongoDB server port number",
    )
    mongo_user: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MONGO_USER", "mongo_user", "user"),
        description="MongoDB username for authentication",
    )
    mongo_password: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MONGO_PASSWORD", "mongo_password", "password"),
        description="MongoDB password for authentication",
    )
    mongo_db: str = Field(
        default="irontracker_analytics",
        validation_alias=AliasChoices("MONGO_DB", "mongo_db", "db"),
        description="MongoDB database name",
    )
    mongo_collection_name: str = Field(
        default="workout_metrics",
        validation_alias=AliasChoices(
            "MONGO_COLLECTION_NAME", "mongo_collection_name", "collection_name"
        ),
        description="Default Time Series collection name",
    )
    mongo_timeseries_time_field: str = Field(
        default="timestamp",
        validation_alias=AliasChoices("MONGO_TIMESERIES_TIME_FIELD", "timeField", "time_field"),
        description="Field containing timestamp for Time Series collection",
    )
    mongo_timeseries_meta_field: str = Field(
        default="metadata",
        validation_alias=AliasChoices("MONGO_TIMESERIES_META_FIELD", "metaField", "meta_field"),
        description="Field containing metadata for Time Series collection",
    )
    mongo_timeseries_granularity: str = Field(
        default="seconds",
        validation_alias=AliasChoices("MONGO_TIMESERIES_GRANULARITY", "granularity"),
        description="Granularity for Time Series collection",
    )
    mongo_auth_source: str = Field(
        default="admin",
        validation_alias=AliasChoices("MONGO_AUTH_SOURCE", "auth_source", "authSource"),
        description="MongoDB authentication database",
    )

    # Kafka consumer parameters (for background analytics processing)
    kafka_bootstrap_servers: str = Field(
        default="localhost:9092",
        validation_alias=AliasChoices("KAFKA_BOOTSTRAP_SERVERS", "kafka_bootstrap_servers"),
        description="Kafka bootstrap servers connection string",
    )
    kafka_consumer_group: str = Field(
        default="analytics-service-group",
        validation_alias=AliasChoices("KAFKA_CONSUMER_GROUP", "kafka_consumer_group"),
        description="Kafka consumer group ID",
    )
    kafka_workout_topic: str = Field(
        default="workout.events",
        validation_alias=AliasChoices("KAFKA_WORKOUT_TOPIC", "kafka_workout_topic"),
        description="Kafka topic for workout events",
    )
    enable_kafka_consumer: bool = Field(
        default=False,
        validation_alias=AliasChoices("ENABLE_KAFKA_CONSUMER", "enable_kafka_consumer"),
        description="Flag to enable background Kafka consumer in FastAPI lifespan",
    )

    @property
    def mongo(self) -> MongoSettings:
        """Return dedicated MongoSettings instance."""
        return MongoSettings(
            host=self.mongo_host,
            port=self.mongo_port,
            user=self.mongo_user,
            password=self.mongo_password,
            db=self.mongo_db,
            timeField=self.mongo_timeseries_time_field,
            metaField=self.mongo_timeseries_meta_field,
            granularity=self.mongo_timeseries_granularity,
            collection_name=self.mongo_collection_name,
            auth_source=self.mongo_auth_source,
        )

    @property
    def mongo_url(self) -> str:
        """Construct async MongoDB connection URL."""
        return self.mongo.mongo_url

    @property
    def APP_NAME(self) -> str:
        """Uppercase accessor for app name."""
        return self.app_name

    @property
    def DEBUG(self) -> bool:
        """Uppercase accessor for debug flag."""
        return self.debug

    @property
    def APP_HOST(self) -> str:
        """Uppercase accessor for app host."""
        return self.app_host

    @property
    def APP_PORT(self) -> int:
        """Uppercase accessor for app port."""
        return self.app_port

    @property
    def MONGO_HOST(self) -> str:
        """Uppercase accessor for Mongo host."""
        return self.mongo_host

    @property
    def MONGO_PORT(self) -> int:
        """Uppercase accessor for Mongo port."""
        return self.mongo_port

    @property
    def MONGO_USER(self) -> str | None:
        """Uppercase accessor for Mongo user."""
        return self.mongo_user

    @property
    def MONGO_PASSWORD(self) -> str | None:
        """Uppercase accessor for Mongo password."""
        return self.mongo_password

    @property
    def MONGO_DB(self) -> str:
        """Uppercase accessor for Mongo database name."""
        return self.mongo_db

    @property
    def MONGO_URL(self) -> str:
        """Uppercase accessor for Mongo URL."""
        return self.mongo_url

    @property
    def MONGO_URI(self) -> str:
        """Uppercase accessor for Mongo URI (alias of MONGO_URL)."""
        return self.mongo_url

    @property
    def mongo_uri(self) -> str:
        """Lowercase alias for mongo_url."""
        return self.mongo_url

    @property
    def KAFKA_BOOTSTRAP_SERVERS(self) -> str:
        """Uppercase accessor for Kafka bootstrap servers."""
        return self.kafka_bootstrap_servers

    @property
    def KAFKA_CONSUMER_GROUP(self) -> str:
        """Uppercase accessor for Kafka consumer group."""
        return self.kafka_consumer_group

    @property
    def KAFKA_WORKOUT_TOPIC(self) -> str:
        """Uppercase accessor for Kafka workout topic."""
        return self.kafka_workout_topic

    @property
    def ENABLE_KAFKA_CONSUMER(self) -> bool:
        """Uppercase accessor for Kafka consumer enable flag."""
        return self.enable_kafka_consumer


@lru_cache
def get_settings() -> Settings:
    """Return cached singleton instance of application settings."""
    return Settings()


settings = get_settings()

__all__ = [
    "MongoSettings",
    "Settings",
    "get_settings",
    "settings",
]
