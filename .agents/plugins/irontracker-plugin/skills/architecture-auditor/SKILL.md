---
name: architecture-auditor
description: "Экспертное руководство по проведению строгого архитектурного аудита кода IronTracker согласно 01-architecture.md, 02-code-style.md и 03-testing.md. Выявляет Dual Write, нарушения Transactional Outbox, сырые JSONB словари, синхронный ввод-вывод и смешивание брокеров. Используй при запросах: проверь архитектуру, аудит кода, critic phase, code review, проверь стандарты, вынеси вердикт."
---

# Architecture Auditor Skill — IronTracker

Данный навык формализует процедуру строгого аудита изменений кодовой базы проекта IronTracker. Применяется архитектурным критиком (`iron-critic`) для вынесения вердикта `VERDICT: APPROVED` либо `VERDICT: REJECTED`.

## Архитектурные аксиомы IronTracker

Любое нарушение следующих аксиом влечет **немедленный REJECT**:

### 1. Безусловный запрет Dual Write (Паттерн Transactional Outbox)
- **Правило:** Прямая одновременная запись в базу данных PostgreSQL и публикация в Apache Kafka из хэндлера API категорически запрещена.
- **Требование:** Workout Service обязан записывать событие в таблицу `outbox` в рамках единой транзакции БД с основной сущностью (`session.commit()` фиксирует одновременно и тренировку, и outbox-запись).
- **Паттерн проверки:**
  - Ищи в коде сервиса прямые вызовы `producer.send(...)` или `aiokafka.AIOKafkaProducer`. Если они вызываются синхронно с HTTP-запросом создания/обновления — это **НАРУШЕНИЕ**.
  - Публикация в Kafka должна осуществляться отдельным фоновым процессом/воркером (Message Relay), вычитывающим `status = 'pending' FOR UPDATE SKIP LOCKED`.

### 2. Строгая валидация JSONB через Discriminated Unions
- **Правило:** Запрещено сохранять или принимать невалидированные словари (`dict`, `Any`, `json`) для метрик упражнений.
- **Требование:** Схемы Pydantic v2 обязаны использовать `Discriminated Unions` с полем-дискриминатором (например `exercise_type`), разделяя силовые (вес, повторы, подходы) и кардио (дистанция, пульс) тренировки.
- **Паттерн проверки:**
  - Наличие `Annotated[Union[...], Field(discriminator="...")]`.

### 3. Строгое разделение брокеров сообщений
- **Kafka:** Используется ИСКЛЮЧИТЕЛЬНО для бизнес-событий (фактов: `workout.completed`).
- **RabbitMQ:** Используется ИСКЛЮЧИТЕЛЬНО для адресных команд и очередей задач (отправка push/email уведомлений через Notification Service).
- **Запрещено:** Подменять Kafka на RabbitMQ или наоборот.

### 4. Рейтинги Leaderboard Service только на Redis ZSET
- **Правило:** Запрещено выполнять расчеты лидербордов и агрегаций в памяти Python-приложения.
- **Требование:** Все скоринги (тоннаж за период, рейтинг атлетов) ведутся только встроенными средствами Redis через `Sorted Sets (ZSET)` (`ZADD`, `ZREVRANGE`, `ZINCRBY`).

### 5. Исключительно асинхронный I/O
- **Разрешенные драйверы:**
  - PostgreSQL: `asyncpg` + `SQLAlchemy 2.0 (async_session)`.
  - Redis: `redis.asyncio` (библиотека `aioredis` СТРОГО ЗАПРЕЩЕНА).
  - MongoDB: `motor`.
  - Kafka: `aiokafka`.
  - RabbitMQ: `aio-pika`.
- **Запрещено:** `requests`, `time.sleep()`, синхронный `psycopg2`, блокирующие вызовы в `async def`.

### 6. Чистота кодовой базы и типизация
- В начале каждого файла моделей и схем присутствует:
  ```python
  from __future__ import annotations
  ```
- Статический анализатор `mypy --strict .` не должен выдавать ошибок.
- Линтер `ruff check .` должен быть зеленым.
- Существующие комментарии разработчиков не удалены.

---

## Формат отчета аудита (`_workspace/03_critic_report.md`)

Отчет должен содержать структурированный разбор каждого пункта:

```markdown
# Архитектурный отчет IronTracker

## Статус проверки критериев:
- [x] Transactional Outbox (Dual Write отсутствует): СООТВЕТСТВУЕТ
- [x] Discriminated Unions для JSONB: СООТВЕТСТВУЕТ
- [x] Разделение брокеров (Kafka/RabbitMQ): СООТВЕТСТВУЕТ
- [x] Асинхронный I/O (asyncpg, redis.asyncio): СООТВЕТСТВУЕТ
- [x] Статическая типизация и линтинг: СООТВЕТСТВУЕТ
- [x] Тесты (включая откат транзакций): СООТВЕТСТВУЕТ

## Итоговый вердикт:
VERDICT: APPROVED
```

Если обнаружены дефекты:

```markdown
# Архитектурный отчет IronTracker

## Выявленные нарушения:
1. **[Dual Write]** В файле `services/workout/service.py:45` обнаружен прямой вызов `await kafka_producer.send()`. Необходимо перенести сохранение события в таблицу `outbox` в рамках сессии SQLAlchemy.
2. **[JSONB Validation]** В схеме `schemas.py:18` метрики объявлены как `metrics: dict`. Требуется заменить на `Discriminated Union` (StrengthExerciseMetrics / CardioExerciseMetrics).

## Итоговый вердикт:
VERDICT: REJECTED
```
