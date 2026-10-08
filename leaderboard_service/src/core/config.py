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


@lru_cache
def get_settings() -> Settings:
    """Return cached singleton instance of application settings."""
    return Settings()


settings = get_settings()

__all__ = [
    "RedisSettings",
    "Settings",
    "get_settings",
    "settings",
]
