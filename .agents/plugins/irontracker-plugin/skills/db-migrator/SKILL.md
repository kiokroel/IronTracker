---
name: db-migrator
description: "Экспертное руководство по управлению миграциями реляционной базы данных PostgreSQL через Alembic в IronTracker согласно db-migration.md. Включает работу с JSONB колонками, индексами, проверку автогенерации, накат (upgrade) и откат (downgrade) миграций. Используй при запросах: миграция, alembic, изменение схемы БД, обнови таблицу, добавь колонку JSONB."
---

# Database Migration Skill (Alembic & PostgreSQL) — IronTracker

Данный навык регламентирует процесс безопасного изменения схемы реляционной базы данных PostgreSQL в **Workout Service** с использованием Alembic и асинхронного драйвера `asyncpg`.

## Архитектурные правила хранения в БД
1. **Жесткие колонки:** Общие поля (ID сущности, `user_id`, дата создания, статус) хранятся в реляционных типизированных колонках (UUID, TIMESTAMP WITH TIME ZONE, VARCHAR).
2. **Гибкие метрики:** Специфичные показатели тренировок хранятся строго в колонке `JSONB` с использованием диалекта:
   ```python
   from sqlalchemy.dialects.postgresql import JSONB
   ```
3. **Таблица Outbox:** Таблица transactional outbox обязана присутствовать в схеме БД Workout Service:
   - `id: UUID` (Primary Key);
   - `event_type: VARCHAR(255)` (название события, например `workout.completed`);
   - `payload: JSONB` (контракт события);
   - `status: VARCHAR(50)` (`pending`, `processed`, `failed`);
   - `retry_count: INTEGER` (дефолт 0);
   - `created_at: TIMESTAMP WITH TIME ZONE`;
   - `processed_at: TIMESTAMP WITH TIME ZONE` (nullable).

---

## Пошаговый алгоритм миграции

### Шаг 1: Изменение моделей SQLAlchemy
1. Открой `models.py` сервиса.
2. Проверь наличие `from __future__ import annotations`.
3. Добавь или измени колонки, используя типы `sqlalchemy` и `sqlalchemy.dialects.postgresql.JSONB`.

Пример модели с Outbox:
```python
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class OutboxModel(Base):
    __tablename__ = "outbox"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### Шаг 2: Проверка регистрации в `alembic/env.py`
Убедись, что объект метаданных моделей подключен к Alembic:
```python
from models import Base
target_metadata = Base.metadata
```

### Шаг 3: Автогенерация миграции
Запусти генерацию ревизии с понятным описанием изменений:
```powershell
alembic revision --autogenerate -m "add_outbox_and_workout_jsonb"
```

### Шаг 4: Ручной аудит сгенерированного файла ревизии
**КРИТИЧЕСКИ ВАЖНО:** Alembic может некорректно определять:
- Изменения внутренних структур в колонках `JSONB`.
- Удаление/добавление GIN-индексов для поиска по JSONB.
- Переименования существующих колонок (Alembic может трактовать как drop + add, что ведет к потере данных).

Убедись, что функции `upgrade()` и `downgrade()` симметричны и безопасны.

### Шаг 5: Применение и проверка отката
1. Примени миграцию:
   ```powershell
   alembic upgrade head
   ```
2. Проверь работоспособность отката (на 1 шаг назад):
   ```powershell
   alembic downgrade -1
   ```
3. Накати обратно до актуального состояния:
   ```powershell
   alembic upgrade head
   ```

---

## Чек-лист безопасности миграций
- [ ] Все JSONB колонки используют `sqlalchemy.dialects.postgresql.JSONB`.
- [ ] Все временные метки используют `timezone=True`.
- [ ] Скрипт ревизии содержит валидный `downgrade()`.
- [ ] Выполнен тестовый цикл `upgrade head` -> `downgrade -1` -> `upgrade head`.
