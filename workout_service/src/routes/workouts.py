from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.controllers.workout import WorkoutController
from workout_service.src.dependencies import get_db, get_optional_user_id
from workout_service.src.schemas.workout import WorkoutCreate, WorkoutResponse, WorkoutUpdate

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.post("", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
async def create_workout(
    workout_in: WorkoutCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID | None, Depends(get_optional_user_id)] = None,
    event_type: Annotated[
        str | None,
        Query(description="Type of outbox event ('workout.created' or 'workout.completed')"),
    ] = None,
    x_event_type: Annotated[
        str | None,
        Header(alias="X-Event-Type", description="Optional outbox event type header"),
    ] = None,
) -> WorkoutResponse:
    """Create a new workout record with validated JSONB metrics and transactional outbox."""
    controller = WorkoutController(db)
    resolved_event_type = x_event_type or event_type or "workout.created"
    if current_user_id is not None:
        workout_in.user_id = current_user_id
    elif workout_in.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id is required either in request body or via Authorization header",
        )
    workout = await controller.create_workout(workout_in, event_type=resolved_event_type)
    return WorkoutResponse.model_validate(workout)


@router.get("", response_model=list[WorkoutResponse])
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


@router.get("/{workout_id}", response_model=WorkoutResponse)
async def get_workout(
    workout_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID | None, Depends(get_optional_user_id)] = None,
) -> WorkoutResponse:
    """Retrieve workout by ID with optional access control."""
    controller = WorkoutController(db)
    workout = await controller.get_workout(workout_id, current_user_id=current_user_id)
    return WorkoutResponse.model_validate(workout)


@router.put("/{workout_id}", response_model=WorkoutResponse)
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


@router.patch("/{workout_id}", response_model=WorkoutResponse)
async def patch_workout(
    workout_id: UUID,
    workout_update: WorkoutUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID | None, Depends(get_optional_user_id)] = None,
) -> WorkoutResponse:
    """Partially update workout record and record update in transactional outbox."""
    controller = WorkoutController(db)
    workout = await controller.update_workout(
        workout_id=workout_id,
        workout_update=workout_update,
        current_user_id=current_user_id,
    )
    return WorkoutResponse.model_validate(workout)


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(
    workout_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID | None, Depends(get_optional_user_id)] = None,
) -> None:
    """Delete workout record and record deletion event in transactional outbox."""
    controller = WorkoutController(db)
    await controller.delete_workout(workout_id=workout_id, current_user_id=current_user_id)
