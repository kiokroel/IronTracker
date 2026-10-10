from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from users_service.src.controllers.user import UserController
from users_service.src.core.database import get_db_session
from users_service.src.dependencies import get_current_user
from users_service.src.schemas.user import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["Users & Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new athlete account",
)
async def register_user(
    payload: UserRegister,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> UserResponse:
    """Register a new user in the platform and return public profile."""
    controller = UserController(db)
    user = await controller.register(payload)
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate and obtain JWT access token",
)
async def login_user(
    payload: UserLogin,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> TokenResponse:
    """Authenticate with email and password, returning signed stateless JWT."""
    controller = UserController(db)
    return await controller.authenticate(payload)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve profile of currently authenticated athlete",
)
async def get_my_profile(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> UserResponse:
    """Return profile details for the authenticated user from JWT credentials."""
    return current_user


@router.put(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update profile details for currently authenticated athlete",
)
async def update_my_profile(
    payload: UserUpdate,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> UserResponse:
    """Update username or password for currently authenticated user."""
    controller = UserController(db)
    updated_user = await controller.update_profile(current_user.id, payload)
    return UserResponse.model_validate(updated_user)
