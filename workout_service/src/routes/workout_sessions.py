from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.controllers.workout_session import WorkoutSessionController
from workout_service.src.dependencies import get_current_user_id, get_db
from workout_service.src.schemas.workout_session import (
    WorkoutSessionCreate,
    WorkoutSessionResponse,
    WorkoutSessionUpdate,
)

router = APIRouter(prefix="/workout-sessions", tags=["workout-sessions"])


@router.get(
    "",
    response_model=list[WorkoutSessionResponse],
    summary="List athlete's workout sessions",
)
async def list_workout_sessions(
    current_user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: Annotated[int, Query(ge=0, description="Offset for pagination")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="Page limit")] = 100,
) -> list[WorkoutSessionResponse]:
    """Retrieve all workout sessions for the authenticated athlete."""
    controller = WorkoutSessionController(db)
    sessions = await controller.list_sessions(
        user_id=current_user_id,
        skip=skip,
        limit=limit,
    )
    return [WorkoutSessionResponse.model_validate(s) for s in sessions]


@router.post(
    "",
    response_model=WorkoutSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new multi-exercise workout session",
)
async def create_workout_session(
    data: WorkoutSessionCreate,
    current_user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkoutSessionResponse:
    """Create a new workout session with multiple exercises and calculate total tonnage."""
    controller = WorkoutSessionController(db)
    session = await controller.create_session(
        user_id=current_user_id,
        data=data,
    )
    return WorkoutSessionResponse.model_validate(session)


@router.get(
    "/{session_id}",
    response_model=WorkoutSessionResponse,
    summary="Get workout session by ID",
)
async def get_workout_session(
    session_id: UUID,
    current_user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkoutSessionResponse:
    """Retrieve details of a specific workout session with IDOR verification."""
    controller = WorkoutSessionController(db)
    session = await controller.get_session(
        session_id=session_id,
        user_id=current_user_id,
    )
    return WorkoutSessionResponse.model_validate(session)


@router.put(
    "/{session_id}",
    response_model=WorkoutSessionResponse,
    summary="Update workout session",
)
async def update_workout_session(
    session_id: UUID,
    data: WorkoutSessionUpdate,
    current_user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkoutSessionResponse:
    """Update workout session fields and exercises with IDOR verification."""
    controller = WorkoutSessionController(db)
    session = await controller.update_session(
        session_id=session_id,
        user_id=current_user_id,
        data=data,
    )
    return WorkoutSessionResponse.model_validate(session)


@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete workout session",
)
async def delete_workout_session(
    session_id: UUID,
    current_user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a workout session with IDOR ownership verification."""
    controller = WorkoutSessionController(db)
    await controller.delete_session(
        session_id=session_id,
        user_id=current_user_id,
    )


__all__ = ["router"]
