from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from users_service.src.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from users_service.src.models.user import UserModel
from users_service.src.repositories.user import UserRepository
from users_service.src.schemas.user import TokenResponse, UserLogin, UserRegister, UserUpdate

logger = logging.getLogger(__name__)


class UserController:
    """Business logic controller handling registration, authentication, and profile updates."""

    def __init__(self, db: AsyncSession) -> None:
        self.repository = UserRepository(db)

    async def register(self, payload: UserRegister) -> UserModel:
        """Register a new athlete account ensuring unique email."""
        existing_user = await self.repository.get_by_email(str(payload.email))
        if existing_user is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with email '{payload.email}' already exists",
            )

        hashed = hash_password(payload.password)
        new_user = await self.repository.create_user(
            email=str(payload.email),
            username=payload.username,
            hashed_password=hashed,
        )
        logger.info(
            "Successfully registered athlete user id=%s email=%s",
            new_user.id,
            new_user.email,
        )
        return new_user

    async def authenticate(self, payload: UserLogin) -> TokenResponse:
        """Verify user credentials and issue signed JWT access token."""
        user = await self.repository.get_by_email(str(payload.email))
        if user is None or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token_payload = {
            "sub": str(user.id),
            "email": user.email,
            "username": user.username,
        }
        token = create_access_token(data=token_payload)
        logger.info("Issued JWT access token for user id=%s", user.id)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user_id=user.id,
            email=user.email,
        )

    async def get_profile(self, user_id: UUID) -> UserModel:
        """Fetch user profile by ID or raise 404."""
        user = await self.repository.get_by_id(user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found",
            )
        return user

    async def update_profile(self, user_id: UUID, payload: UserUpdate) -> UserModel:
        """Update display name or password for athlete account."""
        user = await self.get_profile(user_id)
        if payload.username is not None:
            user.username = payload.username
        if payload.password is not None:
            user.hashed_password = hash_password(payload.password)

        try:
            self.repository.db.add(user)
            await self.repository.db.commit()
            await self.repository.db.refresh(user)
            logger.info("Updated profile for user id=%s", user.id)
            return user
        except Exception:
            await self.repository.db.rollback()
            raise
