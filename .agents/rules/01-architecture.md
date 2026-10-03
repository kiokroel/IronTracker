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