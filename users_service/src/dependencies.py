from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from users_service.src.core.database import get_db_session
from users_service.src.core.security import decode_access_token
from users_service.src.schemas.user import UserResponse

logger = logging.getLogger(__name__)

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(security_scheme)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> UserResponse:
    """Extract and validate current authenticated user from Bearer JWT token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing sub",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = UUID(user_id_str)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("JWT token decoding failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # In users_service, we fetch user from DB to ensure they still exist and return full profile
    from users_service.src.repositories.user import UserRepository

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User belonging to this token no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserResponse.model_validate(user)
