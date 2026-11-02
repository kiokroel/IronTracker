---
name: mobile-developer
description: "Экспертное руководство по разработке и архитектуре мобильного приложения IronTracker на React Native, Expo SDK, TypeScript, NativeWind и Zustand. Охватывает структуру mobile/src/, безопасное хранилище Expo SecureStore, типизированные API-клиенты, навигацию React Navigation (Bottom Tabs, Stack), компоненты для Android/iOS, адаптивность, оптимизацию FlatList и нативное тестирование через Vitest. Используй при запросах: мобилка, mobile, react native, expo, андроид, ios, экран тренировок mobile, каталог mobile, SecureStore, навигация mobile."
---

# IronTracker Mobile Development Guide

Экспертное руководство по проектированию и разработке нативного мобильного приложения платформы **IronTracker** для Android и iOS.

---

## 1. Технологический стек мобильного приложения
- **Фреймворк:** React Native (Expo SDK 52+ / 58).
- **Язык:** TypeScript в строгом режиме (`"strict": true`, полный запрет типа `any`).
- **Стилизация:** NativeWind (Tailwind CSS для React Native, тема *Iron Dark*).
- **Безопасное хранилище:** `expo-secure-store` для JWT токенов авторизации (категорически запрещено использовать открытый `AsyncStorage` для хранения токенов).
- **Управление состоянием:** Zustand (`useAuthStore`, `useWorkoutStore`).
- **Навигация:** `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`.
- **Иконки:** `lucide-react-native`.
- **HTTP клиент:** Axios с интерцептором Bearer JWT и безопасным логаутом при 401 Unauthorized.
- **Тестирование:** Vitest в `mobile/` с моками нативных модулей и проверкой типов через `tsc --noEmit`.

---

## 2. Структура проекта (`mobile/`)

Каталог мобильного приложения изолирован в `./mobile/` монорепозитория:

```
mobile/
├── app.json                    # Манифест конфигурации Expo (Android package, permissions, scheme)
├── package.json                # Зависимости и скрипты (start, android, ios, lint, test)
├── tsconfig.json               # Строгая конфигурация TypeScript
├── tailwind.config.js          # Конфигурация NativeWind (тема Iron Dark)
├── vitest.config.mjs           # Конфигурация Vitest с моками native-окружения
└── src/
    ├── api/                    # Типизированные клиенты к микросервисам бэкенда
    │   ├── client.ts           # Axios инстанс, управление baseURL и токенами Bearer
    │   ├── auth.ts             # Авторизация и регистрация (/api/v1/auth)
    │   ├── exercises.ts        # Каталог упражнений (/api/v1/exercises)
    │   ├── workouts.ts         # Дневник тренировок (/api/v1/workout-sessions)
    │   └── leaderboard.ts      # Таблица лидеров (/api/v1/leaderboard)
    ├── components/             # Переиспользуемые UI-компоненты
    │   ├── ui/                 # Card, Button, Input, Modal, Badge, SetRow
    │   └── common/             # Header, EmptyState, LoadingIndicator
    ├── screens/                # Экраны мобильного приложения
    │   ├── auth/               # LoginScreen, RegisterScreen
    │   ├── catalog/            # ExerciseCatalogModal
    │   ├── WorkoutsScreen.tsx  # Лента и журнал тренировок
    │   ├── LeaderboardScreen.tsx
    │   └── ProfileScreen.tsx   # Профиль атлета и выход из аккаунта
    ├── navigation/             # Навигационные стеки и табы
    │   ├── RootNavigator.tsx   # Корневой переключатель Auth / Main Tab Navigator
    │   └── types.ts            # Типизация параметров навигации React Navigation
    ├── store/                  # Zustand сторы
    │   ├── useAuthStore.ts     # Авторизация с синхронизацией через Expo SecureStore
    │   └── useWorkoutStore.ts  # Активная тренировка, таймер отдыха
    ├── types/                  # TypeScript интерфейсы (Exercise, Session, Set, User)
    └── utils/                  # Утилиты форматирования, расчет 1RM и тоннажа
```

---

## 3. Архитектурные требования и мобильная безопасность

1. **Безопасность учетных данных:**
   - Токены доступа сохраняются исключительно через `SecureStore.setItemAsync('auth_token', token)`.
   - При выходе из приложения или ошибке 401 токен безопасно удаляется через `SecureStore.deleteItemAsync('auth_token')`.

2. **UX и производительность списков:**
   - Списки тренировок и упражнений рендерятся через `FlatList` с уникальными строковыми `keyExtractor`.
   - Поддержка жеста обновления списка (Pull-to-Refresh) через `RefreshControl`.
   - Интеграция `SafeAreaView` из `react-native-safe-area-context` для корректного отображения на экранах с вырезами.

3. **Контроль качества кода (Quality Gate):**
   - `npm --prefix mobile run lint` (`tsc --noEmit`) проходит без ошибок.
   - `npm --prefix mobile test` проходит за секунды.
   - Zero Vanity Testing: тесты проверяют бизнес-логику и работу сетевого слоя, без накрутки строк.
