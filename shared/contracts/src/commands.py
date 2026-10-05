from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class BaseCommand(BaseModel):
    """Base command model for RabbitMQ command contracts."""

    model_config = ConfigDict(extra="forbid")

    command_id: UUID = Field(default_factory=uuid4, description="Unique identifier of the command")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Timestamp when the command was generated in UTC",
    )
    command_type: str = Field(min_length=1, description="Command type identifier")


class SendNotificationCommand(BaseCommand):
    """RabbitMQ command to deliver direct notification to user."""

    model_config = ConfigDict(extra="forbid")

    command_type: Literal["notification.send"] = "notification.send"
    user_id: UUID = Field(description="Target recipient user ID")
    channel: Literal["email", "push"] = Field(description="Delivery channel: email or push")
    title: str = Field(min_length=1, description="Notification title")
    message: str = Field(min_length=1, description="Notification content")


class SendAchievementNotificationCommand(BaseCommand):
    """RabbitMQ command to deliver achievement notification to user."""

    model_config = ConfigDict(extra="forbid")

    command_type: Literal["notification.achievement"] = "notification.achievement"
    user_id: UUID = Field(description="Target recipient user ID")
    achievement_code: str = Field(min_length=1, description="Unique achievement identifier")
    title: str = Field(min_length=1, description="Achievement title")
    message: str = Field(min_length=1, description="Achievement description or body")
