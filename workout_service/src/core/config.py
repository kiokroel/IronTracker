from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field

# Load environment variables from .env file if available
load_dotenv()


class Settings(BaseModel):
    """Workout Service application configuration with safe defaults."""

    model_config = ConfigDict(extra="forbid")

    postgres_host: str = Field(
        default_factory=lambda: os.getenv("POSTGRES_HOST", "localhost"),
        description="PostgreSQL hostname",
    )
    postgres_port: int = Field(
        default_factory=lambda: int(os.getenv("POSTGRES_PORT", "5432")),
        description="PostgreSQL port",
    )
    postgres_user: str = Field(
        default_factory=lambda: os.getenv("POSTGRES_USER", "irontracker"),
        description="PostgreSQL username",
    )
    postgres_password: str = Field(
        default_factory=lambda: os.getenv("POSTGRES_PASSWORD", "irontracker_secret"),
        description="PostgreSQL password",
    )
    postgres_db: str = Field(
        default_factory=lambda: os.getenv("POSTGRES_DB", "irontracker_workout"),
        description="PostgreSQL database name",
    )

    db_echo: bool = Field(
        default_factory=lambda: os.getenv("DB_ECHO", "false").lower() in ("true", "1", "yes"),
        description="Enable SQLAlchemy query echo logging",
    )
    db_pool_size: int = Field(
        default_factory=lambda: int(os.getenv("DB_POOL_SIZE", "10")),
        description="Connection pool size",
    )
    db_max_overflow: int = Field(
        default_factory=lambda: int(os.getenv("DB_MAX_OVERFLOW", "20")),
        description="Max overflow connections in pool",
    )

    kafka_bootstrap_servers: str = Field(
        default_factory=lambda: os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
        description="Kafka bootstrap servers",
    )
    kafka_workout_topic: str = Field(
        default_factory=lambda: os.getenv("KAFKA_WORKOUT_TOPIC", "workout.events"),
        description="Kafka topic for workout events",
    )
    outbox_poll_interval: float = Field(
        default_factory=lambda: float(os.getenv("OUTBOX_POLL_INTERVAL", "1.0")),
        description="Interval in seconds between outbox polling passes",
    )
    outbox_batch_size: int = Field(
        default_factory=lambda: int(os.getenv("OUTBOX_BATCH_SIZE", "50")),
        description="Number of outbox records to process in a single batch",
    )
    outbox_max_retries: int = Field(
        default_factory=lambda: int(os.getenv("OUTBOX_MAX_RETRIES", "3")),
        description="Maximum retry attempts before marking an outbox record as failed",
    )

    @property
    def database_url(self) -> str:
        """Construct async PostgreSQL connection URL with asyncpg driver."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@"
            f"{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()


settings = get_settings()
