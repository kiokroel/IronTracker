from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Schema for analytics service liveness probe response."""

    model_config = ConfigDict(frozen=True)

    status: str = Field(
        default="ok",
        description="Service health status",
        examples=["ok"],
    )
    service: str = Field(
        default="analytics",
        description="Service identifier",
        examples=["analytics"],
    )


class ReadyResponse(BaseModel):
    """Schema for successful analytics service readiness probe response."""

    model_config = ConfigDict(frozen=True)

    status: str = Field(
        default="ready",
        description="Service readiness status",
        examples=["ready"],
    )
    database: str = Field(
        default="connected",
        description="Database connection status",
        examples=["connected"],
    )
    mongodb: str = Field(
        default="connected",
        description="MongoDB connection status alias",
        examples=["connected"],
    )


class ReadyErrorResponse(BaseModel):
    """Schema for failed analytics service readiness probe response."""

    model_config = ConfigDict(frozen=True)

    status: str = Field(
        default="unavailable",
        description="Service readiness status",
        examples=["unavailable"],
    )
    database: str = Field(
        default="disconnected",
        description="Database connection status",
        examples=["disconnected"],
    )
    mongodb: str = Field(
        default="disconnected",
        description="MongoDB connection status alias",
        examples=["disconnected"],
    )
    detail: str = Field(
        ...,
        description="Detailed failure description",
        examples=["MongoDB ping failed: ServerSelectionTimeoutError"],
    )


__all__ = [
    "HealthResponse",
    "ReadyErrorResponse",
    "ReadyResponse",
]
