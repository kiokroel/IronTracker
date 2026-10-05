# IronTracker Agent Guidelines

## Ханес: IronTracker (`irontracker-plugin`)

**Цель:** Автоматизация полного цикла разработки, тестирования и архитектурного контроля микросервисов IronTracker по мультиагентной схеме (Разработчик -> Тестировщик -> Критик).

**Триггер:** При любых запросах на разработку фич, создание/изменение API эндпоинтов, моделей, миграций БД или аудит бэкенда IronTracker обязательно используй навык `iron-orchestrator`. Простые вопросы общего характера могут обрабатываться напрямую.

**История изменений:**
| Дата | Описание изменения | Объект | Причина |
|:---|:---|:---|:---|
| 2026-10-04 | Начальная конфигурация ханеса: субагенты iron-developer, iron-tester, iron-critic и навыки iron-orchestrator, endpoint-developer, db-migrator, architecture-auditor, test-runner | irontracker-plugin | Инициализация мультиагентного ханеса проекта |
| 2026-10-04 | Добавлена автоматизация коммита, пуша ветки и создания Pull Request с описанием после утверждения изменений | iron-orchestrator, 04-git-flow, dev-critic-tester | Автоматизация финализации задач по запросу пользователя |
| 2026-10-05 | Внедрение проверок безопасности: SAST (bandit), аудит зависимостей (pip-audit), запрет бэкдоров, защита от IDOR и утечек секретов | iron-tester, iron-critic, iron-developer, skills, workflows | Усиление безопасности и защита кодовой базы от бэкдоров и уязвимостей |
| 2026-10-05 | Стандартизация слоистой структуры папок микросервисов: core (config, database, security), models, schemas, repositories (BaseRepository), controllers/services, routes, dependencies | PROJECT_CONTEXT, 01-architecture, 02-code-style, endpoint-developer, architecture-auditor, agents | Приведение архитектуры микросервисов к строгому стандарту слоистой изоляции|

