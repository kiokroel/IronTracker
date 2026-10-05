from __future__ import annotations

from uuid import UUID

from fastapi import Header, HTTPException, status

from workout_service.src.core.database import get_db, get_db_session


async def get_optional_user_id(
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
) -> UUID | None:
    """Optional dependency to extract current user UUID from X-User-ID header."""
    if x_user_id is None:
        return None
    try:
        return UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format in X-User-ID header",
        ) from exc


__all__ = [
    "get_db",
    "get_db_session",
    "get_optional_user_id",
]
