from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationDispatchResult(BaseModel):
    """Result of processing and dispatching a notification command."""

    model_config = ConfigDict(extra="forbid")

    command_id: UUID = Field(description="Unique identifier of the executed command")
    user_id: UUID = Field(description="Target recipient user ID")
    channel: str = Field(description="Delivery channel used (email, push, etc.)")
    status: Literal["sent", "failed", "retried"] = Field(
        description="Dispatch execution status",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="UTC timestamp of dispatch completion",
    )
    details: dict[str, Any] = Field(
        default_factory=dict,
        description="Metadata and dispatch payload details",
    )
    error_message: str | None = Field(
        default=None,
        description="Error details if delivery failed",
    )


__all__ = [
    "NotificationDispatchResult",
]
