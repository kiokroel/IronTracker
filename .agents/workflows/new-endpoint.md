# Workflow: Создание нового эндпоинта

При получении задачи на создание нового API эндпоинта, действуй строго по следующим шагам слоистой архитектуры (по образцу VKR):

1. **DTO Layer (`src/schemas/<entity>.py`):**
   - Создай Pydantic v2 схемы для Request и Response в соответствующем модуле `src/schemas/` (например, `src/schemas/workout.py`).
   - Реэкспортируй схемы в `src/schemas/__init__.py`.
   - Опиши строгую валидацию (например, вес > 0, пульс > 0).
   - Для полиморфных метрик (силовые/кардио упражнения в `JSONB`) используй Discriminated Unions (`Annotated[Union[...], Field(discriminator=...)]`).

2. **Models Layer (`src/models/<entity>.py`):**
   - Убедись в наличии ORM-модели SQLAlchemy 2.0 в `src/models/` (наследуется от `Base` из `src.core.database`).
   - Реэкспортируй модель в `src/models/__init__.py`.
   - При необходимости изменения схемы БД создай миграцию Alembic (`alembic revision --autogenerate`).

3. **Repository Layer (`src/repositories/<entity>.py`):**
   - Наследуй репозиторий сущности от обобщенного `BaseRepository` из `src/repositories/base.py`.
   - Напиши асинхронные методы работы с БД через SQLAlchemy 2.0 (`select()`, `insert()`, `update()`).
   - Для Workout Service: сохранение сущности тренировки и записи в таблицу `outbox` ОБЯЗАТЕЛЬНО выполняется в рамках единой транзакции (`async_session`).
   - Реэкспортируй репозиторий в `src/repositories/__init__.py`.

4. **Controller/Service Layer (`src/controllers/<entity>.py`):**
   - Реализуй бизнес-логику в `src/controllers/<entity>.py` (например, `WorkoutController`).
   - Контроллер принимает валидированные DTO, инкапсулирует бизнес-проверки, вызывает репозиторий и возвращает DTO ответа (не привязываясь к объектам `Request` FastAPI).
   - Если операция мутирует данные в Workout Service, контроллер формирует контракт события (из `shared/contracts`) для сохранения в Outbox.
   - Реэкспортируй контроллер в `src/controllers/__init__.py`.

5. **Routes Layer (`src/routes/<entity>.py` и `src/dependencies.py`):**
   - Зарегистрируй эндпоинты в `src/routes/<entity>.py` (например, `src/routes/workouts.py`).
   - Внедри зависимости через `src/dependencies.py` (`Depends(get_db)`, аутентификация пользователя) и вызови соответствующий метод контроллера.
   - Подключи роутер сущности в корневой `router = APIRouter()` в `src/routes/__init__.py`, который подключается в `src/main.py`.

6. **Testing & QA:**
   - Напиши интеграционный тест в `tests/` с использованием `httpx.AsyncClient` и `@pytest.mark.asyncio`.
   - Для Workout Service обязательно проверь транзакционность Outbox:
     - При успешном запросе запись в таблице `outbox` гарантированно создается со статусом `pending`;
     - При ошибке/откате транзакции запись в `outbox` отсутствует.
   - Запусти `pytest`, `ruff check .`, `mypy --strict .`, `bandit` и `pip-audit`. Не отмечай задачу как выполненную, пока все проверки не будут зелеными.