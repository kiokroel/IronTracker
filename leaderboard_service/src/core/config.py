from __future__ import annotations

from functools import lru_cache

from dotenv import find_dotenv, load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load environment variables from .env file if available
load_dotenv(find_dotenv(usecwd=True))


class RedisSettings(BaseSettings):
    """Configuration for Redis connection and credentials."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    redis_host: str = Field(
        default="localhost",
        validation_alias=AliasChoices("REDIS_HOST", "redis_host"),
        description="Redis server hostname or IP address",
    )
    redis_port: int = Field(
        default=6379,
        validation_alias=AliasChoices("REDIS_PORT", "redis_port"),
        description="Redis server port",
    )
    redis_db: int = Field(
        default=0,
        validation_alias=AliasChoices("REDIS_DB", "redis_db"),
        description="Redis logical database index",
    )
    redis_password: str | None = Field(
        default=None,
        validation_alias=AliasChoices("REDIS_PASSWORD", "redis_password"),
        description="Optional Redis password",
    )

    @property
    def redis_url(self) -> str:
        """Construct async Redis connection URL."""
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def REDIS_HOST(self) -> str:
        """Uppercase accessor for Redis host."""
        return self.redis_host

    @property
    def REDIS_PORT(self) -> int:
        """Uppercase accessor for Redis port."""
        return self.redis_port

    @property
    def REDIS_DB(self) -> int:
        """Uppercase accessor for Redis DB."""
        return self.redis_db

    @property
    def REDIS_PASSWORD(self) -> str | None:
        """Uppercase accessor for Redis password."""
        return self.redis_password

    @property
    def REDIS_URL(self) -> str:
        """Uppercase accessor for Redis connection URL."""
        return self.redis_url


class KafkaSettings(BaseSettings):
    """Configuration for Kafka connection, consumer group, and topics."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    kafka_bootstrap_servers: str = Field(
        default="localhost:9092",
        validation_alias=AliasChoices("KAFKA_BOOTSTRAP_SERVERS", "kafka_bootstrap_servers"),
        description="Kafka bootstrap servers connection string",
    )
    kafka_consumer_group: str = Field(
        default="leaderboard-service-group",
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


class Settings(BaseSettings):
    """Leaderboard Service application settings with safe defaults."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = Field(
        default="IronTracker Leaderboard Service",
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
        default=8002,
        validation_alias=AliasChoices("APP_PORT", "app_port"),
        description="HTTP server port",
    )

    redis_host: str = Field(
        default="localhost",
        validation_alias=AliasChoices("REDIS_HOST", "redis_host"),
        description="Redis server hostname or IP address",
    )
    redis_port: int = Field(
        default=6379,
        validation_alias=AliasChoices("REDIS_PORT", "redis_port"),
        description="Redis server port",
    )
    redis_db: int = Field(
        default=0,
        validation_alias=AliasChoices("REDIS_DB", "redis_db"),
        description="Redis logical database index",
    )
    redis_password: str | None = Field(
        default=None,
        validation_alias=AliasChoices("REDIS_PASSWORD", "redis_password"),
        description="Optional Redis password",
    )

    kafka_bootstrap_servers: str = Field(
        default="localhost:9092",
        validation_alias=AliasChoices("KAFKA_BOOTSTRAP_SERVERS", "kafka_bootstrap_servers"),
        description="Kafka bootstrap servers connection string",
    )
    kafka_consumer_group: str = Field(
        default="leaderboard-service-group",
        validation_alias=AliasChoices("KAFKA_CONSUMER_GROUP", "kafka_consumer_group"),
        description="Kafka consumer group ID",
    )
    kafka_workout_topic: str = Field(
        default="workout.events",
        validation_alias=AliasChoices("KAFKA_WORKOUT_TOPIC", "kafka_workout_topic"),
        description="Kafka topic for workout events",
    )
    leaderboard_tonnage_key: str = Field(
        default="leaderboard:tonnage",
        validation_alias=AliasChoices("LEADERBOARD_TONNAGE_KEY", "leaderboard_tonnage_key"),
        description="Redis Sorted Set key for user tonnage leaderboard",
    )
    enable_kafka_consumer: bool = Field(
        default=False,
        validation_alias=AliasChoices("ENABLE_KAFKA_CONSUMER", "enable_kafka_consumer"),
        description="Flag to enable background Kafka consumer in FastAPI lifespan",
    )

    @property
    def redis(self) -> RedisSettings:
        """Return dedicated RedisSettings instance."""
        return RedisSettings(
            redis_host=self.redis_host,
            redis_port=self.redis_port,
            redis_db=self.redis_db,
            redis_password=self.redis_password,
        )

    @property
    def kafka(self) -> KafkaSettings:
        """Return dedicated KafkaSettings instance."""
        return KafkaSettings(
            kafka_bootstrap_servers=self.kafka_bootstrap_servers,
            kafka_consumer_group=self.kafka_consumer_group,
            kafka_workout_topic=self.kafka_workout_topic,
            enable_kafka_consumer=self.enable_kafka_consumer,
        )

    @property
    def redis_url(self) -> str:
        """Construct async Redis connection URL."""
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

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
    def REDIS_HOST(self) -> str:
        """Uppercase accessor for Redis host."""
        return self.redis_host

    @property
    def REDIS_PORT(self) -> int:
        """Uppercase accessor for Redis port."""
        return self.redis_port

    @property
    def REDIS_DB(self) -> int:
        """Uppercase accessor for Redis DB."""
        return self.redis_db

    @property
    def REDIS_PASSWORD(self) -> str | None:
        """Uppercase accessor for Redis password."""
        return self.redis_password

    @property
    def REDIS_URL(self) -> str:
        """Uppercase accessor for Redis connection URL."""
        return self.redis_url

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
    def LEADERBOARD_TONNAGE_KEY(self) -> str:
        """Uppercase accessor for leaderboard tonnage key."""
        return self.leaderboard_tonnage_key

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
    "KafkaSettings",
    "RedisSettings",
    "Settings",
    "get_settings",
    "settings",
]
