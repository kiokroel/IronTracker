---
trigger: always_on
---

# Стандарты работы с Git (Branching & Commits)

При выполнении любой задачи ты ОБЯЗАН использовать Git MCP сервер для изоляции изменений. Запрещено писать код в ветке `main` или `master`.

## 1. Создание ветки (Branching)
Перед написанием первой строчки кода ты должен создать и переключиться на новую ветку.

**Шаблон:** `<type>/<task-id>-<short-description>`

- `<type>`: `feat` (новая фича), `fix` (исправление), `refactor` (рефакторинг), `chore` (настройки).
- `<task-id>`: ID карточки из Notion (например, `IT-12` или `TASK-45`). Если ID нет, используй `no-id`.
- `<short-description>`: 2-4 слова на английском, разделенные дефисом (`kebab-case`).

**Пример команды через Git MCP:** `git checkout -b feat/IT-12-workout-jsonb-model`

## 2. Именование коммитов (Conventional Commits)
Коммиты должны быть атомарными (одна логическая задача = один коммит) и строго следовать спецификации Conventional Commits.

**Шаблон:** `<type>(<scope>): <subject>`

- `<scope>`: Название микросервиса или модуля (например: `workout`, `analytics`, `infra`, `api`).

**Правила:**
- Не ставь точку в конце сообщения.
- Используй повелительное наклонение на английском языке (`add`, `update`, `fix`).
- Укажи ID задачи из Notion в теле коммита (Body), если применимо.

**Пример:**
```
feat(workout): add outbox pattern support for postgres
fix(leaderboard): resolve redis zset parsing error
```

## 3. Рабочий процесс (Git Workflow)
1. Получил задачу из Notion (перевел в `In progress` согласно `05-notion-tasks.md`) -> создал ветку.
2. Написал тесты и логику -> проверил статус (`git status`).
3. Добавил изменения (`git add .`).
4. Сделал коммит по шаблону.
5. Если задача выполнена, перевел статус карточки в Notion в `Done` и запросил у пользователя разрешение на слияние (merge) или создание Pull Request.
