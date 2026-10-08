from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Schema for service liveness probe response."""

    model_config = ConfigDict(frozen=True)

    status: str = Field(
        default="ok",
        description="Service health status",
        examples=["ok"],
    )
    service: str = Field(
        default="leaderboard",
        description="Service identifier",
        examples=["leaderboard"],
    )


class ReadyResponse(BaseModel):
    """Schema for successful service readiness probe response."""

    model_config = ConfigDict(frozen=True)

    status: str = Field(
        default="ready",
        description="Service readiness status",
        examples=["ready"],
    )
    redis: str = Field(
        default="connected",
        description="Redis connection status",
        examples=["connected"],
    )


class ReadyErrorResponse(BaseModel):
    """Schema for failed service readiness probe response."""

    model_config = ConfigDict(frozen=True)

    status: str = Field(
        default="unavailable",
        description="Service readiness status",
        examples=["unavailable"],
    )
    redis: str = Field(
        default="disconnected",
        description="Redis connection status",
        examples=["disconnected"],
    )
    detail: str = Field(
        ...,
        description="Detailed failure description",
        examples=["Redis connection failed: Connection refused"],
    )


__all__ = [
    "HealthResponse",
    "ReadyErrorResponse",
    "ReadyResponse",
]
