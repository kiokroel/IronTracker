from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from shared.contracts.src.events import WorkoutCompletedEvent


class WorkoutMetadata(BaseModel):
    """Metadata subdocument for MongoDB Time Series collection."""

    model_config = ConfigDict(extra="ignore")

    user_id: str = Field(description="User UUID as string")
    workout_id: str = Field(description="Workout UUID as string")
    exercise_type: str = Field(description="Exercise type identifier")
    exercise_name: str | None = Field(
        default=None,
        description="Name of the exercise (if applicable)",
    )
    rpe: float | None = Field(
        default=None,
        ge=1,
        le=10,
        description="Rate of Perceived Exertion (1-10)",
    )


WorkoutTimeSeriesMetadata = WorkoutMetadata


class OneRepMaxBreakdown(BaseModel):
    """Breakdown of 1RM calculation across 7 scientific formulas."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    epley: float = Field(description="Epley formula 1RM estimate")
    brzycki: float = Field(description="Brzycki formula 1RM estimate")
    lander: float = Field(description="Lander formula 1RM estimate")
    lombardi: float = Field(description="Lombardi formula 1RM estimate")
    mayhew: float = Field(description="Mayhew formula 1RM estimate")
    oconner: float = Field(
        validation_alias=AliasChoices("oconner", "o_conner"),
        description="O'Conner formula 1RM estimate",
    )
    wathan: float = Field(description="Wathan formula 1RM estimate")
    average: float = Field(description="Composite average of all 7 formulas")

    @property
    def o_conner(self) -> float:
        """Alias property for oconner."""
        return self.oconner


class WorkoutTimeSeriesPoint(BaseModel):
    """Point model stored in MongoDB Time Series collection 'workout_metrics'."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, alias="_id", description="MongoDB ObjectId")
    timestamp: datetime = Field(description="Timestamp of workout completion (timeField)")
    metadata: WorkoutMetadata = Field(description="Metadata describing the series (metaField)")

    # Macro-metrics
    one_rep_max: float | None = Field(
        default=None,
        description="Composite 1RM average in kg (rounded to 2 decimals)",
    )
    one_rep_max_average: float | None = Field(
        default=None,
        description="Alias for composite 1RM average",
    )
    detailed_1rm: OneRepMaxBreakdown | None = Field(
        default=None,
        description="Breakdown of 1RM estimates across all 7 scientific formulas",
    )
    breakdowns: OneRepMaxBreakdown | None = Field(
        default=None,
        description="Alias for detailed_1rm breakdown",
    )
    tonnage: float = Field(
        default=0.0,
        description="Total volume in kg lifted during the workout (weight * sets * reps)",
    )

    # Strength details
    weight: float | None = Field(default=None, description="Working weight in kg")
    reps: int | None = Field(default=None, description="Repetitions completed per set")
    sets: int | None = Field(default=None, description="Sets completed")

    # Cardio details
    distance_km: float | None = Field(default=None, description="Distance in kilometers")
    duration_minutes: float | None = Field(default=None, description="Duration in minutes")
    heart_rate: int | None = Field(default=None, description="Average heart rate")
    calories_burned: int | None = Field(default=None, description="Estimated calories burned")

    # Measurement dictionary
    metrics: dict[str, Any] | None = Field(
        default=None,
        description="Summary dictionary of measurements for fast inspection",
    )

    def to_mongo_doc(self) -> dict[str, Any]:
        """Convert point to MongoDB dictionary representation."""
        doc = self.model_dump(by_alias=True, exclude_none=True)
        if "_id" in doc and doc["_id"] is None:
            del doc["_id"]
        # Ensure timestamp is UTC aware datetime
        if isinstance(self.timestamp, datetime):
            if self.timestamp.tzinfo is None:
                doc["timestamp"] = self.timestamp.replace(tzinfo=UTC)
            else:
                doc["timestamp"] = self.timestamp
        return doc

    @classmethod
    def from_event(cls, event: WorkoutCompletedEvent) -> WorkoutTimeSeriesPoint:
        """Construct WorkoutTimeSeriesPoint from WorkoutCompletedEvent."""
        from analytics_service.src.services.calculator import (
            calculate_1rm_breakdown,
            calculate_workout_tonnage,
            is_cardio_exercise,
            is_strength_exercise,
        )

        ts = event.completed_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)

        m = event.metrics
        exercise_name = getattr(m, "exercise_name", None) or getattr(m, "exercise_type", "unknown")
        rpe = getattr(m, "rpe", None)

        meta = WorkoutMetadata(
            user_id=str(event.user_id),
            workout_id=str(event.workout_id),
            exercise_type=m.exercise_type,
            exercise_name=exercise_name,
            rpe=rpe,
        )

        if is_strength_exercise(m):
            weight = float(getattr(m, "weight", 0.0))
            reps = int(getattr(m, "reps", 0))
            sets = int(getattr(m, "sets", 0))
            tonnage = calculate_workout_tonnage(m)
            breakdown = calculate_1rm_breakdown(weight, reps)
            composite_1rm = breakdown.average

            metrics_dict: dict[str, Any] = {
                "one_rep_max": composite_1rm,
                "tonnage": tonnage,
                "weight": weight,
                "reps": reps,
                "sets": sets,
                "detailed_1rm": breakdown.model_dump(),
            }

            return cls(
                timestamp=ts,
                metadata=meta,
                one_rep_max=composite_1rm,
                one_rep_max_average=composite_1rm,
                detailed_1rm=breakdown,
                breakdowns=breakdown,
                tonnage=tonnage,
                weight=weight,
                reps=reps,
                sets=sets,
                metrics=metrics_dict,
            )

        if is_cardio_exercise(m):
            distance_km = float(getattr(m, "distance_km", 0.0))
            duration_minutes = float(getattr(m, "duration_minutes", 0.0))
            heart_rate = getattr(m, "heart_rate", None)
            calories_burned = getattr(m, "calories_burned", None)

            metrics_dict = {
                "tonnage": 0.0,
                "distance_km": distance_km,
                "duration_minutes": duration_minutes,
                "heart_rate": heart_rate,
                "calories_burned": calories_burned,
            }

            return cls(
                timestamp=ts,
                metadata=meta,
                one_rep_max=None,
                one_rep_max_average=None,
                detailed_1rm=None,
                breakdowns=None,
                tonnage=0.0,
                distance_km=distance_km,
                duration_minutes=duration_minutes,
                heart_rate=heart_rate,
                calories_burned=calories_burned,
                metrics=metrics_dict,
            )

        # Fallback for unrecognized metrics
        return cls(
            timestamp=ts,
            metadata=meta,
            tonnage=0.0,
            metrics={"tonnage": 0.0},
        )


__all__ = [
    "OneRepMaxBreakdown",
    "WorkoutMetadata",
    "WorkoutTimeSeriesMetadata",
    "WorkoutTimeSeriesPoint",
]
