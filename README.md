# IronTracker 🏋️‍♂️

Бэкенд-платформа для любителей и профессионалов тяжелой атлетики, пауэрлифтинга и силового многоборья на базе микросервисной архитектуры.

## О проекте

IronTracker позволяет атлетам вести дневники тренировок с детальными показателями (силовые упражнения: жим лежа, приседания, становая тяга; кардио: бег, дистанция, пульс). Система в реальном времени строит динамические лидерборды по тоннажу и агрегирует глубокую аналитику нагрузок.

## Архитектура микросервисов

1. **Workout Service (`FastAPI` + `PostgreSQL` + `SQLAlchemy 2.0 Async`):**
   - Единая точка входа для CRUD тренировок.
   - Специфичные метрики упражнений валидируются через Discriminated Unions Pydantic v2 и сохраняются в колонку `JSONB`.
   - Надежная публикация событий через паттерн **Transactional Outbox** в PostgreSQL.

2. **Leaderboard Service (`FastAPI` + `Redis`):**
   - Построение лидербордов и рейтингов в реальном времени.
   - Расчет метрик и сортировок исключительно через структуры Redis `Sorted Sets (ZSET)`.

3. **Analytics Service (Async Worker + `Kafka` + `MongoDB`):**
   - Фоновый воркер, асинхронно вычитывающий бизнес-события из Kafka.
   - Агрегация макро-показателей и временных рядов (Time Series) прогрессии нагрузок и 1RM в MongoDB.

4. **Notification Service (Async Worker + `RabbitMQ`):**
   - Изолированный фоновый consumer для отправки уведомлений атлетам (личные рекорды, напоминания).
   - Обработка сбоев и повторные попытки через Dead Letter Exchange (DLX).

## Технологический стек

- **Язык**: Python 3.12+
- **API Framework**: FastAPI, Pydantic v2, Uvicorn
- **Базы данных**: PostgreSQL (реляционные данные + JSONB), MongoDB (аналитика / Time Series), Redis (кэш и ZSET-рейтинги)
- **Брокеры сообщений**: 
  - Apache Kafka (бизнес-события, факт-стриминг)
  - RabbitMQ (адресные команды, очереди сообщений)
- **Инфраструктура**: Docker, Docker Compose
- **Качество кода**: `ruff`, `mypy` (strict mode), `pytest` + `pytest-asyncio`

## Запуск инфраструктуры (Docker)

Для локальной разработки микросервисов все необходимые базы данных и брокеры сообщений разворачиваются через Docker Compose:

1. Скопируйте файл конфигурации окружения:
   ```bash
   cp .env.example .env
   ```

2. Запустите инфраструктуру:
   ```bash
   docker compose up -d
   ```

3. *(Опционально)* Для запуска вместе с веб-интерфейсом Kafka UI:
   ```bash
   docker compose --profile tools up -d
   ```

### Доступные сервисы и порты:
| Сервис | Порт хоста | Назначение / Сервис IronTracker |
|---|---|---|
| **PostgreSQL** | `5432` | Workout Service (реляционные данные, Outbox) |
| **Redis** | `6379` | Leaderboard Service (ZSET рейтинги) |
| **MongoDB** | `27017` | Analytics Service (Time Series аналитика) |
| **Apache Kafka (KRaft)** | `9092` | Шина бизнес-событий (факты) |
| **RabbitMQ AMQP** | `5672` | Очереди команд (Notification Service) |
| **RabbitMQ Management UI** | `15672` | Панель управления RabbitMQ (`http://localhost:15672`) |
| **Kafka UI (профиль tools)** | `8085` | Веб-интерфейс Kafka (`http://localhost:8085`) |

## Правила репозитория

- Вся работа над задачами ведется согласно Notion Kanban Board.
- Ветвление: Git Flow (`<type>/<task-id>-<short-description>`).
- Сообщения коммитов: Conventional Commits (`<type>(<scope>): <subject>`).

