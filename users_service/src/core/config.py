from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field

load_dotenv()


class Settings(BaseModel):
    """Users Service application configuration."""

    model_config = ConfigDict(extra="ignore")

    app_name: str = Field(
        default="IronTracker Users Service",
        description="Application display name",
    )
    app_host: str = Field(
        default_factory=lambda: os.getenv("APP_HOST", "127.0.0.1"),
        description="HTTP server host",
    )
    app_port: int = Field(
        default_factory=lambda: int(os.getenv("APP_PORT", "8001")),
        description="HTTP server port",
    )

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

    jwt_secret_key: str = Field(
        default_factory=lambda: os.getenv(
            "JWT_SECRET_KEY", "irontracker_super_secure_jwt_secret_key_2026_dev"
        ),
        description="Secret key for signing JWT tokens",
    )
    jwt_algorithm: str = Field(
        default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256"),
        description="JWT cryptographic signing algorithm",
    )
    access_token_expire_minutes: int = Field(
        default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")),
        description="Token expiration duration in minutes",
    )

    @property
    def database_url(self) -> str:
        """Construct asyncpg connection URL."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@"
            f"{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()


settings = get_settings()
