from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.controllers.exercise import ExerciseController
from workout_service.src.dependencies import get_current_user_id, get_db, get_optional_user_id
from workout_service.src.schemas.exercise import ExerciseCreate, ExerciseResponse

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID | None, Depends(get_optional_user_id)] = None,
    category: Annotated[
        str | None,
        Query(description="Filter by exercise category: strength, cardio, bodyweight"),
    ] = None,
    muscle_group: Annotated[
        str | None,
        Query(
            description=(
                "Filter by target muscle group: chest, back, legs, shoulders, arms, core, full_body"
            )
        ),
    ] = None,
    equipment: Annotated[
        str | None,
        Query(
            description=(
                "Filter by equipment: barbell, dumbbell, machine, cable, bodyweight, other"
            )
        ),
    ] = None,
    search: Annotated[
        str | None,
        Query(description="Search exercise name query"),
    ] = None,
    only_my_custom: Annotated[
        bool,
        Query(description="If true, return only user's personal custom exercises"),
    ] = False,
    skip: Annotated[int, Query(ge=0, description="Offset for pagination")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="Page size limit")] = 100,
) -> list[ExerciseResponse]:
    """List accessible library exercises (system exercises + authorized user custom exercises)."""
    controller = ExerciseController(db)
    exercises = await controller.list_exercises(
        user_id=current_user_id,
        category=category,
        muscle_group=muscle_group,
        equipment=equipment,
        search=search,
        only_my_custom=only_my_custom,
        skip=skip,
        limit=limit,
    )
    return [ExerciseResponse.model_validate(e) for e in exercises]


@router.post("", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_exercise(
    exercise_in: ExerciseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> ExerciseResponse:
    """Create a new custom exercise for the authenticated athlete."""
    controller = ExerciseController(db)
    created = await controller.create_custom_exercise(exercise_in, user_id=current_user_id)
    return ExerciseResponse.model_validate(created)


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID | None, Depends(get_optional_user_id)] = None,
) -> ExerciseResponse:
    """Retrieve an exercise by ID with IDOR protection."""
    controller = ExerciseController(db)
    exercise = await controller.get_exercise(exercise_id, user_id=current_user_id)
    return ExerciseResponse.model_validate(exercise)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_exercise(
    exercise_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> Response:
    """Delete athlete's custom exercise enforcing IDOR and system immutability rules."""
    controller = ExerciseController(db)
    await controller.delete_custom_exercise(exercise_id, user_id=current_user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
