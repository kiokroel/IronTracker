---
name: test-runner
description: "Экспертное руководство по написанию и запуску тестов для микросервисов IronTracker согласно 03-testing.md. Охватывает pytest-asyncio, httpx.AsyncClient, тестирование атомарности Transactional Outbox (commit vs rollback), валидацию JSONB и запуск ruff/mypy. Используй при запросах: запусти тесты, протестируй эндпоинт, pytest, ruff, mypy, напиши интеграционный тест, проверь outbox."
---

# Test Runner Skill — IronTracker

Данный навык определяет методологию написания, структурирования и запуска тестов для компонентов бэкенда IronTracker.

## Стек тестирования
- Фреймворк: `pytest`
- Асинхронные тесты: `pytest-asyncio` (с `asyncio_mode = "auto"`)
- HTTP клиент: `httpx.AsyncClient`
- Линтинг и форматирование: `ruff check .`, `ruff format --check .`
- Статическая типизация: `mypy --strict .`

---

## 1. Тестирование атомарности Transactional Outbox

В **Workout Service** ключевое требование надежности — консистентность таблицы `outbox`. На каждый сценарий модификации тренировки обязательны два теста:

### Тест успешного коммита:
```python
from __future__ import annotations
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from main import app
from models import WorkoutModel, OutboxModel

@pytest.mark.asyncio
async def test_create_workout_creates_outbox_entry(db_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "user_id": "11111111-1111-1111-1111-111111111111",
            "date": "2026-10-04T12:00:00Z",
            "metrics": {
                "exercise_type": "strength",
                "exercise_name": "bench_press",
                "weight": 100.0,
                "sets": 5,
                "reps": 5
            }
        }
        response = await client.post("/workouts", json=payload)
        assert response.status_code == 201

        # Проверка создания тренировки в БД
        workout_id = response.json()["id"]
        workout = await db_session.get(WorkoutModel, workout_id)
        assert workout is not None

        # Проверка гарантированного создания записи в outbox:
        outbox_res = await db_session.execute(
            select(OutboxModel).where(OutboxModel.payload["user_id"].astext == payload["user_id"])
        )
        outbox_entry = outbox_res.scalar_one_or_none()
        assert outbox_entry is not None
        assert outbox_entry.status == "pending"
        assert outbox_entry.event_type == "workout.completed"
```

### Тест отката транзакции (Rollback Consistency):
```python
@pytest.mark.asyncio
async def test_failed_workout_rolls_back_outbox(db_session: AsyncSession) -> None:
    # При искусственной ошибке сохранения тренировки запись outbox не должна появиться
    pass
```

---

## 2. Тестирование валидации Discriminated Unions

Необходимо проверять отклонение некорректных типов данных:

```python
@pytest.mark.asyncio
async def test_create_workout_invalid_metric_fails() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Отрицательный вес недопустим (gt=0)
        invalid_payload = {
            "user_id": "11111111-1111-1111-1111-111111111111",
            "date": "2026-10-04T12:00:00Z",
            "metrics": {
                "exercise_type": "strength",
                "exercise_name": "squat",
                "weight": -10.0,
                "sets": 3,
                "reps": 5
            }
        }
        response = await client.post("/workouts", json=invalid_payload)
        assert response.status_code == 422
```

---

## 3. Команды запуска и проверки качества

Субагент `iron-tester` обязан выполнить:

1. **Линтинг:**
   ```powershell
   ruff check .
   ```
2. **Проверка типов в строгом режиме:**
   ```powershell
   mypy --strict .
   ```
3. **Запуск тестового набора:**
   ```powershell
   pytest -v
   ```

---

## Формат отчета тестирования (`_workspace/02_tester_report.md`)

```markdown
# Отчет тестирования IronTracker

## Статус: PASS / FAIL

## Результаты проверок качества:
- **Ruff:** 0 errors
- **Mypy strict:** 0 errors
- **Pytest:** 14 passed, 0 failed

## Проверенные критические сценарии:
- [x] Transactional Outbox: запись создана со статусом `pending` при успешном коммите
- [x] Transactional Outbox: запись отсутствует при rollback
- [x] Pydantic v2 Discriminated Unions: 422 при некорректной схеме
- [x] Лидерборд: корректность обновления Redis ZSET

## Стектрейсы (при наличии падений):
[Нет ошибок]
```
