from __future__ import annotations

from functools import lru_cache

from dotenv import find_dotenv, load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load environment variables from .env file if available
load_dotenv(find_dotenv(usecwd=True))


class RabbitMQSettings(BaseSettings):
    """Configuration settings for RabbitMQ connection, queues, and Dead Letter Exchange."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    rabbitmq_host: str = Field(
        default="localhost",
        validation_alias=AliasChoices("RABBITMQ_HOST", "rabbitmq_host"),
        description="RabbitMQ server hostname or IP address",
    )
    rabbitmq_port: int = Field(
        default=5672,
        validation_alias=AliasChoices("RABBITMQ_PORT", "rabbitmq_port"),
        description="RabbitMQ AMQP port",
    )
    rabbitmq_user: str = Field(
        default="irontracker",
        validation_alias=AliasChoices("RABBITMQ_USER", "rabbitmq_user"),
        description="RabbitMQ authentication username",
    )
    rabbitmq_password: str = Field(
        default="irontracker_rabbit_secret",
        validation_alias=AliasChoices("RABBITMQ_PASSWORD", "rabbitmq_password"),
        description="RabbitMQ authentication password",
    )
    rabbitmq_vhost: str = Field(
        default="/",
        validation_alias=AliasChoices("RABBITMQ_VHOST", "rabbitmq_vhost"),
        description="RabbitMQ virtual host",
    )
    rabbitmq_queue: str = Field(
        default="notifications_queue",
        validation_alias=AliasChoices("RABBITMQ_QUEUE", "rabbitmq_queue"),
        description="Main command queue for notification delivery",
    )
    rabbitmq_exchange: str = Field(
        default="notifications_exchange",
        validation_alias=AliasChoices("RABBITMQ_EXCHANGE", "rabbitmq_exchange"),
        description="Direct exchange for dispatching notification commands",
    )
    rabbitmq_routing_key: str = Field(
        default="notification.dispatch",
        validation_alias=AliasChoices("RABBITMQ_ROUTING_KEY", "rabbitmq_routing_key"),
        description="Routing key for direct command delivery",
    )
    rabbitmq_dlx_exchange: str = Field(
        default="notifications_dlx",
        validation_alias=AliasChoices("RABBITMQ_DLX_EXCHANGE", "rabbitmq_dlx_exchange"),
        description="Dead Letter Exchange for failed commands",
    )
    rabbitmq_dlq_queue: str = Field(
        default="notifications_dlq",
        validation_alias=AliasChoices("RABBITMQ_DLQ_QUEUE", "rabbitmq_dlq_queue"),
        description="Dead Letter Queue capturing unprocessable commands",
    )
    rabbitmq_dlx_routing_key: str = Field(
        default="notification.dead_letter",
        validation_alias=AliasChoices("RABBITMQ_DLX_ROUTING_KEY", "rabbitmq_dlx_routing_key"),
        description="Routing key used to forward unprocessable commands to DLQ",
    )

    @property
    def amqp_url(self) -> str:
        """Construct async RabbitMQ connection URL (AMQP)."""
        return (
            f"amqp://{self.rabbitmq_user}:{self.rabbitmq_password}@"
            f"{self.rabbitmq_host}:{self.rabbitmq_port}/{self.rabbitmq_vhost.lstrip('/')}"
        )

    @property
    def RABBITMQ_HOST(self) -> str:
        """Uppercase accessor for RabbitMQ host."""
        return self.rabbitmq_host

    @property
    def RABBITMQ_PORT(self) -> int:
        """Uppercase accessor for RabbitMQ port."""
        return self.rabbitmq_port

    @property
    def RABBITMQ_USER(self) -> str:
        """Uppercase accessor for RabbitMQ user."""
        return self.rabbitmq_user

    @property
    def RABBITMQ_PASSWORD(self) -> str:
        """Uppercase accessor for RabbitMQ password."""
        return self.rabbitmq_password

    @property
    def RABBITMQ_VHOST(self) -> str:
        """Uppercase accessor for RabbitMQ vhost."""
        return self.rabbitmq_vhost

    @property
    def RABBITMQ_QUEUE(self) -> str:
        """Uppercase accessor for RabbitMQ main queue."""
        return self.rabbitmq_queue

    @property
    def RABBITMQ_EXCHANGE(self) -> str:
        """Uppercase accessor for RabbitMQ main exchange."""
        return self.rabbitmq_exchange

    @property
    def RABBITMQ_ROUTING_KEY(self) -> str:
        """Uppercase accessor for RabbitMQ routing key."""
        return self.rabbitmq_routing_key

    @property
    def RABBITMQ_DLX_EXCHANGE(self) -> str:
        """Uppercase accessor for RabbitMQ DLX exchange."""
        return self.rabbitmq_dlx_exchange

    @property
    def RABBITMQ_DLQ_QUEUE(self) -> str:
        """Uppercase accessor for RabbitMQ DLQ queue."""
        return self.rabbitmq_dlq_queue

    @property
    def RABBITMQ_DLX_ROUTING_KEY(self) -> str:
        """Uppercase accessor for RabbitMQ DLX routing key."""
        return self.rabbitmq_dlx_routing_key

    @property
    def AMQP_URL(self) -> str:
        """Uppercase accessor for AMQP connection URL."""
        return self.amqp_url


class Settings(RabbitMQSettings):
    """Notification Service global application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = Field(
        default="IronTracker Notification Service",
        validation_alias=AliasChoices("APP_NAME", "app_name"),
        description="Notification service application display name",
    )
    debug: bool = Field(
        default=False,
        validation_alias=AliasChoices("DEBUG", "debug"),
        description="Flag enabling verbose debugging",
    )

    @property
    def rabbitmq(self) -> RabbitMQSettings:
        """Return dedicated RabbitMQSettings instance."""
        return RabbitMQSettings(
            rabbitmq_host=self.rabbitmq_host,
            rabbitmq_port=self.rabbitmq_port,
            rabbitmq_user=self.rabbitmq_user,
            rabbitmq_password=self.rabbitmq_password,
            rabbitmq_vhost=self.rabbitmq_vhost,
            rabbitmq_queue=self.rabbitmq_queue,
            rabbitmq_exchange=self.rabbitmq_exchange,
            rabbitmq_routing_key=self.rabbitmq_routing_key,
            rabbitmq_dlx_exchange=self.rabbitmq_dlx_exchange,
            rabbitmq_dlq_queue=self.rabbitmq_dlq_queue,
            rabbitmq_dlx_routing_key=self.rabbitmq_dlx_routing_key,
        )

    @property
    def APP_NAME(self) -> str:
        """Uppercase accessor for app name."""
        return self.app_name

    @property
    def DEBUG(self) -> bool:
        """Uppercase accessor for debug flag."""
        return self.debug


@lru_cache
def get_settings() -> Settings:
    """Return cached singleton instance of application settings."""
    return Settings()


settings = get_settings()

__all__ = [
    "RabbitMQSettings",
    "Settings",
    "get_settings",
    "settings",
]
