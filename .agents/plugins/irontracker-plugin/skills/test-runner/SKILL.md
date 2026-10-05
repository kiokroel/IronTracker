---
name: test-runner
description: "Экспертное руководство по написанию и запуску тестов и аудиту безопасности для микросервисов IronTracker согласно 03-testing.md. Охватывает pytest-asyncio, httpx.AsyncClient, тестирование атомарности Transactional Outbox (commit vs rollback), валидацию JSONB, проверки безопасности (bandit, pip-audit, IDOR, инъекции) и запуск ruff/mypy. Используй при запросах: запусти тесты, протестируй эндпоинт, pytest, ruff, mypy, bandit, pip-audit, безопасность, напиши интеграционный тест, проверь outbox."
---

# Test Runner Skill — IronTracker

Данный навык определяет методологию написания, структурирования и запуска тестов, а также проверок информационной безопасности для компонентов бэкенда IronTracker.

## Стек тестирования и безопасности
- Фреймворк: `pytest`
- Асинхронные тесты: `pytest-asyncio` (с `asyncio_mode = "auto"`)
- HTTP клиент: `httpx.AsyncClient`
- Линтинг и форматирование: `ruff check .`, `ruff format --check .`
- Статическая типизация: `mypy --strict .`
- Статический анализ безопасности (SAST): `bandit`
- Аудит уязвимостей сторонних зависимостей: `pip-audit`

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

## 3. Тестирование безопасности и поиск уязвимостей (Security QA)

Тестировщик обязан верифицировать защищенность системы от уязвимостей и атак:

### Проверка разграничения прав и защита от IDOR:
```python
@pytest.mark.asyncio
async def test_user_cannot_access_foreign_workout() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Попытка доступа к ресурсу другого пользователя должна отклоняться
        response = await client.get(
            "/workouts/foreign-workout-id",
            headers={"X-User-ID": "user-attacker-id"}
        )
        assert response.status_code in (403, 404)
```

### Защита от инъекций и фаззинг граничных значений:
- Все эндпоинты с JSONB и поисковыми запросами должны тестироваться на передачу специальных символов, невалидных payload и попытки внедрения инъекций.

---

## 4. Команды запуска проверок качества и безопасности

Субагент `iron-tester` обязан выполнить полный цикл проверок:

1. **Линтинг и форматирование:**
   ```powershell
   ruff check .
   ruff format --check .
   ```
2. **Проверка типов в строгом режиме:**
   ```powershell
   mypy --strict .
   ```
3. **Статический анализ безопасности (SAST Bandit):**
   ```powershell
   bandit -r workout_service/ leaderboard_service/ analytics_service/ notification_service/ shared/ tests/ -ll
   ```
4. **Аудит безопасности зависимостей (CVE Scan):**
   ```powershell
   pip-audit
   ```
5. **Запуск тестового набора:**
   ```powershell
   pytest -v
   ```

---

## Формат отчета тестирования (`_workspace/02_tester_report.md`)

```markdown
# Отчет тестирования и безопасности IronTracker (QA Report)

## Статус: PASS / FAIL

## Результаты проверок качества и безопасности:
- **Ruff (Linter & Format):** 0 errors
- **Mypy strict:** 0 errors
- **Bandit (SAST Security):** 0 issues identified
- **pip-audit (CVE Scan):** 0 vulnerabilities found
- **Pytest:** X passed, 0 failed

## Проверенные критические сценарии:
- [x] Transactional Outbox: запись создана со статусом `pending` при успешном коммите
- [x] Transactional Outbox: запись отсутствует при rollback
- [x] Pydantic v2 Discriminated Unions: 422 при некорректной схеме
- [x] Лидерборд: корректность обновления Redis ZSET
- [x] Security: защита от IDOR и несанкционированного доступа
- [x] Security: параметризация запросов и защита от инъекций

## Стектрейсы и отчеты уязвимостей (при наличии падений):
[Нет ошибок]
```
