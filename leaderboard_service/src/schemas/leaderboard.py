from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LeaderboardEntry(BaseModel):
    """Schema representing an individual user entry in a leaderboard."""

    model_config = ConfigDict(frozen=True)

    rank: int = Field(
        ...,
        ge=1,
        description="Позиция пользователя в рейтинге (1-indexed)",
        examples=[1],
    )
    user_id: UUID = Field(
        ...,
        description="Идентификатор пользователя",
        examples=["a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"],
    )
    score: float = Field(
        ...,
        ge=0,
        description="Суммарный тоннаж пользователя в кг",
        examples=[12500.0],
    )


class LeaderboardResponse(BaseModel):
    """Schema for paginated leaderboard query response."""

    model_config = ConfigDict(frozen=True)

    metric: str = Field(
        default="tonnage",
        description="Рейтинговая метрика",
        examples=["tonnage"],
    )
    total_entries: int = Field(
        default=0,
        ge=0,
        description="Общее число участников в рейтинге",
        examples=[42],
    )
    entries: list[LeaderboardEntry] = Field(
        default_factory=list,
        description="Список участников рейтинга в порядке убывания очков",
    )


class UserRankResponse(BaseModel):
    """Schema for individual user rank and score query response."""

    model_config = ConfigDict(frozen=True)

    user_id: UUID = Field(
        ...,
        description="Идентификатор пользователя",
        examples=["a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"],
    )
    rank: int | None = Field(
        default=None,
        description="Позиция пользователя (1-indexed), None если нет записей",
        examples=[1],
    )
    score: float = Field(
        default=0.0,
        ge=0,
        description="Суммарный тоннаж в кг",
        examples=[12500.0],
    )


__all__ = [
    "LeaderboardEntry",
    "LeaderboardResponse",
    "UserRankResponse",
]
