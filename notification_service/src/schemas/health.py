from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Notification service health check response schema."""

    model_config = ConfigDict(extra="forbid")

    status: str = Field(
        default="ok",
        description="Service operational status indicator",
    )
    service: str = Field(
        default="notification",
        description="Subsystem service identifier",
    )


class QueueTopologyResponse(BaseModel):
    """Queue and DLX topology declaration response schema."""

    model_config = ConfigDict(extra="forbid")

    queue: str = Field(description="Main RabbitMQ command queue name")
    exchange: str = Field(description="Main direct exchange name")
    dlx: str = Field(description="Dead Letter Exchange name")
    dlq: str = Field(description="Dead Letter Queue name")


__all__ = [
    "HealthResponse",
    "QueueTopologyResponse",
]
