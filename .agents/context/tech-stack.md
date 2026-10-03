# Технологический стек IronTracker

## Основной бэкенд
- **Python**: 3.12+
- **Web Framework (API Services)**: FastAPI
- **Worker Framework (Event Consumers)**: чистый `asyncio` или `FastStream`
- **Validation**: Pydantic v2
- **Server**: Uvicorn (для FastAPI сервисов)

## Базы данных и брокеры
- **PostgreSQL**: Драйвер `asyncpg`, ORM `SQLAlchemy 2.0` (строго асинхронный паттерн).
- **Миграции**: `Alembic`
- **Redis**: Драйвер `redis.asyncio` (использование ZSET для рейтингов).
- **MongoDB**: Драйвер `motor`.
- **Kafka**: Драйвер `aiokafka` (или FastStream).
- **RabbitMQ**: Драйвер `aio-pika` (или FastStream).

## Тестирование и QA
- **Unit/Integration**: `pytest`, `pytest-asyncio`, `httpx` (для тестирования FastAPI).
- **Среда для тестов**: `testcontainers-python` (Postgres, Redis).
- **Нагрузочное тестирование**: Скрипты для Apache JMeter (для проверки пропускной способности эндпоинтов).

## Линтинг и стандарты кодирования
- **Линтер**: `ruff` (высокая скорость, поддержка `pyproject.toml`).
- **Форматтер**: `ruff` или `black`.
- **Type Checking**: `mypy` (интеграция с PyCharm/VS Code).
- **Ключевое правило**:
  ```python
  from __future__ import annotations
  # Обязательно для Pydantic v2 и FastAPI для корректной работы с рекурсивными моделями
  ```
- **Файл конфигурации**: `.ruff.toml` (обязателен для хранения правил линтинга и форматирования).