---
name: endpoint-developer
description: "Экспертное руководство по разработке и изменению эндпоинтов FastAPI в микросервисах IronTracker согласно new-endpoint.md. Охватывает строгие DTO с Discriminated Unions для JSONB, сервисный слой, асинхронные репозитории SQLAlchemy 2.0, Transactional Outbox и регистрацию роутеров. Используй при запросах: создай эндпоинт, добавь роут, API endpoint, schemas, DTO, router, CRUD workout."
---

# Endpoint Developer Skill — IronTracker

Данный навык определяет строгий пошаговый порядок создания и расширения API эндпоинтов в микросервисах IronTracker.

## Архитектурные принципы слоя API
- В начале каждого файла схем и моделей обязателен импорт:
  ```python
  from __future__ import annotations
  ```
- **Слоистая изоляция:**
  1. `schemas.py` — DTO запроса и ответа на Pydantic v2.
  2. `services.py` — Чистая бизнес-логика. Не оперирует объектами `Request` из FastAPI.
  3. `repositories.py` — Асинхронная работа с БД через SQLAlchemy 2.0 (`select`, `insert`, `update`).
  4. `router.py` — FastAPI роутер, инъекция зависимостей (`Depends`), вызов сервиса, HTTP статус-коды.

---

## 1. Слой DTO и валидация JSONB (`schemas.py`)

Для полиморфных метрик (силовые упражнения vs кардио) в PostgreSQL `JSONB` обязательно использование **Discriminated Unions** в Pydantic v2:

```python
from __future__ import annotations
from typing import Annotated, Literal, Union
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class StrengthExerciseMetrics(BaseModel):
    exercise_type: Literal["strength"] = "strength"
    exercise_name: str = Field(..., min_length=1, max_length=100)
    weight: float = Field(..., gt=0, description="Вес снаряда в кг")
    sets: int = Field(..., gt=0, description="Количество подходов")
    reps: int = Field(..., gt=0, description="Количество повторений в подходе")

class CardioExerciseMetrics(BaseModel):
    exercise_type: Literal["cardio"] = "cardio"
    exercise_name: str = Field(..., min_length=1, max_length=100)
    distance_km: float = Field(..., gt=0, description="Дистанция в километрах")
    heart_rate: int = Field(..., gt=30, lt=250, description="Средний пульс")
    duration_minutes: int = Field(..., gt=0, description="Длительность в минутах")

# Дискриминированное объединение типов упражнений:
ExerciseMetrics = Annotated[
    Union[StrengthExerciseMetrics, CardioExerciseMetrics],
    Field(discriminator="exercise_type")
]

class CreateWorkoutRequest(BaseModel):
    user_id: UUID
    date: datetime
    metrics: ExerciseMetrics

class WorkoutResponse(BaseModel):
    id: UUID
    user_id: UUID
    date: datetime
    metrics: ExerciseMetrics
    created_at: datetime
```

---

## 2. Слой репозитория и Transactional Outbox (`repositories.py`)

В **Workout Service** сохранение сущности и события в таблицу `outbox` ОБЯЗАТЕЛЬНО выполняется в одной транзакции:

```python
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

class WorkoutRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_workout_with_outbox(
        self,
        user_id: uuid.UUID,
        workout_date: datetime,
        metrics_dict: dict,
        event_type: str,
        event_payload: dict,
    ) -> WorkoutModel:
        workout = WorkoutModel(
            id=uuid.uuid4(),
            user_id=user_id,
            date=workout_date,
            metrics=metrics_dict,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(workout)

        # Transactional Outbox запись в той же транзакции:
        outbox_entry = OutboxModel(
            id=uuid.uuid4(),
            event_type=event_type,
            payload=event_payload,
            status="pending",
            retry_count=0,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(outbox_entry)

        await self.session.commit()
        await self.session.refresh(workout)
        return workout
```

---

## 3. Сервисный слой (`services.py`)

Сервис принимает валидированный DTO, формирует контракт события и вызывает репозиторий:

```python
from __future__ import annotations
import uuid
from schemas import CreateWorkoutRequest, WorkoutResponse
from repositories import WorkoutRepository

class WorkoutService:
    def __init__(self, repo: WorkoutRepository) -> None:
        self.repo = repo

    async def create_workout(self, dto: CreateWorkoutRequest) -> WorkoutResponse:
        metrics_dump = dto.metrics.model_dump()
        event_payload = {
            "workout_id": str(uuid.uuid4()),
            "user_id": str(dto.user_id),
            "exercise_type": dto.metrics.exercise_type,
            "metrics": metrics_dump,
        }
        model = await self.repo.create_workout_with_outbox(
            user_id=dto.user_id,
            workout_date=dto.date,
            metrics_dict=metrics_dump,
            event_type="workout.completed",
            event_payload=event_payload,
        )
        return WorkoutResponse.model_validate(model, from_attributes=True)
```

---

## 4. Контроллер / Роутер (`router.py`)

```python
from __future__ import annotations
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from schemas import CreateWorkoutRequest, WorkoutResponse
from services import WorkoutService
from repositories import WorkoutRepository
from database import get_async_session

router = APIRouter(prefix="/workouts", tags=["Workouts"])

@router.post("", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
async def create_workout_endpoint(
    request: CreateWorkoutRequest,
    session: AsyncSession = Depends(get_async_session),
) -> WorkoutResponse:
    repo = WorkoutRepository(session)
    service = WorkoutService(repo)
    return await service.create_workout(request)
```

---

## Чек-лист проверки реализации
- [ ] Добавлен `from __future__ import annotations` во всех новых файлах.
- [ ] Валидация специфичных метрик в JSONB реализована через Discriminated Unions Pydantic v2.
- [ ] Dual Write отсутствует: событие пишется в `outbox` в рамках единой транзакции БД.
- [ ] Все вызовы ввода-вывода асинхронны (`async/await`, `asyncpg`).
