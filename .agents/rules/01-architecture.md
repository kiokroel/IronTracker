---
trigger: always_on
---

# Архитектурные стандарты IronTracker

## Зоны ответственности микросервисов
1. **Workout Service (FastAPI + PostgreSQL):** Единая точка входа для CRUD тренировок.
   - Общие данные (ID, дата) хранятся в жестких колонках.
   - Специфичные метрики обязательно сохраняются в колонку `JSONB`. Например, схема для силовых упражнений: `{"exercise": "bench_press", "weight": 107.5, "sets": 5, "reps": 5}`, для кардио — `{"exercise": "treadmill", "distance_km": 5, "heart_rate": 140}`.
   - Управление схемой БД осуществляется СТРОГО через миграции Alembic.
2. **Leaderboard Service (FastAPI + Redis):** Вычисление рейтингов в реальном времени. Все рейтинги (например, тоннаж) считаются исключительно через Redis `ZSET`. Вычисления в памяти приложения строго запрещены.
3. **Analytics Service (Async Worker + Kafka + MongoDB):** Фоновый демон. Асинхронное чтение событий из Kafka и агрегация макро-показателей во временные ряды (Time Series) в MongoDB.
4. **Notification Service (Async Worker + RabbitMQ):** Изолированный фоновый consumer для отправки уведомлений с механизмом ретраев через Dead Letter Exchange.

## Строгие ограничения (Critical Rules)
- **Изолированная Docker-инфраструктура:** Вся инфраструктура (PostgreSQL, Redis, MongoDB, Kafka, RabbitMQ) запускается ИСКЛЮЧИТЕЛЬНО в Docker-контейнерах через `docker compose up -d`. Использование локально установленных служб хоста строго запрещено для чистоты системы и воспроизводимости окружения.
- **Разделение брокеров:** Запрещено смешивать брокеры. Kafka используется исключительно для бизнес-событий (фактов, например, завершения тренировки). RabbitMQ применяется только для адресных команд (например, отправки писем).
- **Паттерн Transactional Outbox:** Прямая запись (Dual Write) в БД и Kafka одновременно строго запрещена для обеспечения согласованности данных.
  - **Таблица Outbox в PostgreSQL:** События Workout Service сначала пишутся в таблицу `outbox` в рамках одной транзакции с самой тренировкой. Обязательные поля:
    - `id: UUID` (первичный ключ);
    - `event_type: str` (имя события, например `workout.completed`);
    - `payload: JSONB` (сериализованный контракт события);
    - `status: str` (`pending`, `processed`, `failed`);
    - `created_at: datetime` (временная метка создания);
    - `processed_at: datetime | None` (метка успешной отправки);
    - `retry_count: int` (количество попыток).
  - **Message Relay (Outbox Processor):** Фоновый воркер периодически вычитывает пачки записей `WHERE status = 'pending' ORDER BY created_at LIMIT N FOR UPDATE SKIP LOCKED`, отправляет в Kafka через `aiokafka` и проставляет `status = 'processed'`, `processed_at = now()`.
- **Валидация JSONB метрик:**
  - В БД данные хранятся в `JSONB`, но в коде приложения они ОБЯЗАНЫ валидироваться строгими Pydantic v2 схемами с использованием Discriminated Unions (например, `Annotated[Union[StrengthExercise, CardioExercise], Field(discriminator="exercise_type")]`). Запись сырого невалидированного словаря запрещена.
- **Межсервисные контракты (Contracts):**
  - Схемы событий для Kafka и команд для RabbitMQ должны быть централизованы в общем модуле (например, `packages/contracts/` или `shared/contracts/`) во избежание дрейфа форматов данных между сервисами.
- **Изоляция сервисов и эталонная слоистая структура:**
  - Каждый микросервис обязан находиться в собственной отдельной директории в корневом каталоге монорепозитория по типу `./<service>_service/` (например, `./workout_service/`, `./leaderboard_service/`, `./analytics_service/`, `./notification_service/`). Внутри каждой папки сервиса обязательно расположены:
    - `Dockerfile` (базовый с комментарием-заглушкой для контейнеризации);
    - `pyproject.toml` (независимый список зависимостей сервиса, полный отказ от requirements.txt);
    - `alembic.ini` и каталог `alembic/` (при использовании реляционной БД: `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/`);
    - `src/` — обязательная многослойная модульная структура (плоское сваливание файлов в корень `src/` СТРОГО ЗАПРЕЩЕНО):
      - `src/__init__.py`: корень пакета исходного кода сервиса.
      - `src/main.py`: точка входа приложения FastAPI (создание `FastAPI`, CORS middleware, агрегация роутеров через `app.include_router(router)`, эндпоинт `/health`, запуск `uvicorn`). Для воркеров — `src/main.py` или `src/worker.py`.
      - `src/dependencies.py`: зависимости FastAPI (`get_db`, авторизация, контекст пользователя).
      - `src/core/`: системные компоненты и конфигурации:
        - `config.py`: типизированные настройки на базе `pydantic-settings` (группированные классы настроек, чтение из `.env`);
        - `database.py`: создание `create_async_engine`, `async_sessionmaker`, базового класса `Base = DeclarativeBase` и асинхронного генератора сессий `get_db()`;
        - `security.py`: криптография, JWT токены, пароли (при наличии авторизации);
        - `__init__.py`: реэкспорт основных объектов ядра.
      - `src/models/`: SQLAlchemy 2.0 ORM-модели:
        - `workout.py`, `outbox.py` и др. Каждая доменная сущность изолирована в своем файле.
        - `__init__.py`: реэкспорт всех моделей сервиса.
      - `src/schemas/`: схемы валидации и DTO на Pydantic v2:
        - `workout.py`: схемы Create, Update, Response, и полиморфные Discriminated Unions для `JSONB` метрик.
        - `__init__.py`: реэкспорт DTO схем.
      - `src/repositories/`: слой абстракции доступа к данным:
        - `base.py`: обобщенный базовый репозиторий `BaseRepository[T, CreateSchemaType, UpdateSchemaType]` с базовым async CRUD (`get`, `get_all`, `create`, `update`, `delete`);
        - `workout.py`: специализированный репозиторий с кастомными SQL-запросами и транзакционным Transactional Outbox;
        - `__init__.py`: реэкспорт репозиториев.
      - `src/controllers/` (или `src/services/`): слой бизнес-логики:
        - `workout.py`: бизнес-операции, проверка инвариантов, формирование Outbox событий, вызовы репозиториев;
        - `__init__.py`: реэкспорт контроллеров/сервисов.
      - `src/routes/`: HTTP-эндпоинты FastAPI:
        - `workouts.py`: обработчики запросов, статус-коды HTTP, инъекция `Depends(get_db)`;
        - `__init__.py`: корневой агрегирующий `router = APIRouter()`, объединяющий дочерние роутеры через `router.include_router(...)`.
  - Общие контракты находятся в `./shared/contracts/` с собственным `pyproject.toml` и `src/`.
  - Каждый сервис обязан содержать собственный независимый `pyproject.toml` со своим списком зависимостей. Использование монолитного `requirements.txt` категорически запрещено.