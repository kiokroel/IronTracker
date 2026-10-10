from __future__ import annotations

import os
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Header, HTTPException, status

from workout_service.src.core.database import get_db, get_db_session

# Secret key matching users_service for stateless token decoding
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "irontracker_super_secure_jwt_secret_key_2026_dev")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


async def get_optional_user_id(
    x_user_id: Annotated[str | None, Header(alias="X-User-ID")] = None,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> UUID | None:
    """Extract authenticated user UUID from Bearer JWT or backward-compatible X-User-ID."""
    # 1. Bearer JWT authentication (Primary stateless auth)
    if authorization is not None and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            sub = payload.get("sub")
            if sub:
                return UUID(str(sub))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired authentication token: {exc}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    # 2. Backward compatibility with X-User-ID header
    if x_user_id is not None:
        try:
            return UUID(x_user_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid UUID format in X-User-ID header",
            ) from exc

    return None


__all__ = [
    "get_db",
    "get_db_session",
    "get_optional_user_id",
]
