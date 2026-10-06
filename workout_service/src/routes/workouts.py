from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.controllers.workout import WorkoutController
from workout_service.src.dependencies import get_db, get_optional_user_id
from workout_service.src.schemas.workout import WorkoutCreate, WorkoutResponse, WorkoutUpdate

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.post("", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
async def create_workout(
    workout_in: WorkoutCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkoutResponse:
    """Create a new workout record with validated JSONB metrics and transactional outbox."""
    controller = WorkoutController(db)
    workout = await controller.create_workout(workout_in)
    return WorkoutResponse.model_validate(workout)


@router.get("/{workout_id}", response_model=WorkoutResponse)
@router.get("/{workout_id}/", response_model=WorkoutResponse, include_in_schema=False)
async def get_workout(
    workout_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID | None, Depends(get_optional_user_id)] = None,
) -> WorkoutResponse:
    """Retrieve workout by ID with optional access control."""
    controller = WorkoutController(db)
    workout = await controller.get_workout(workout_id, current_user_id=current_user_id)
    return WorkoutResponse.model_validate(workout)


@router.get("", response_model=list[WorkoutResponse])
@router.get("/", response_model=list[WorkoutResponse])
async def list_workouts(
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[UUID | None, Query(description="Filter workouts by user ID")] = None,
    skip: Annotated[int, Query(ge=0, description="Offset for pagination")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="Page size limit")] = 100,
) -> list[WorkoutResponse]:
    """List workouts with optional user filter and pagination."""
    controller = WorkoutController(db)
    if user_id is not None:
        workouts = await controller.get_user_workouts(user_id=user_id, skip=skip, limit=limit)
    else:
        workouts = await controller.get_all_workouts(skip=skip, limit=limit)
    return [WorkoutResponse.model_validate(w) for w in workouts]


@router.put("/{workout_id}", response_model=WorkoutResponse)
@router.put("/{workout_id}/", response_model=WorkoutResponse, include_in_schema=False)
async def update_workout(
    workout_id: UUID,
    workout_update: WorkoutUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID | None, Depends(get_optional_user_id)] = None,
) -> WorkoutResponse:
    """Update workout record and record update in transactional outbox."""
    controller = WorkoutController(db)
    workout = await controller.update_workout(
        workout_id=workout_id,
        workout_update=workout_update,
        current_user_id=current_user_id,
    )
    return WorkoutResponse.model_validate(workout)


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{workout_id}/", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
async def delete_workout(
    workout_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID | None, Depends(get_optional_user_id)] = None,
) -> None:
    """Delete workout record and record deletion event in transactional outbox."""
    controller = WorkoutController(db)
    await controller.delete_workout(workout_id=workout_id, current_user_id=current_user_id)
