---
name: frontend-developer
description: "Экспертное руководство по разработке и архитектуре клиентской части IronTracker на React 18+, TypeScript, Tailwind CSS, Vite и Zustand. Охватывает модульную структуру frontend/src/, типизированные API-клиенты с Bearer JWT, UI-компоненты для тренировок и лидерборда, графики 1RM на Recharts, формулы силовых показателей, валидацию Zod и контейнеризацию в Docker. Используй при запросах: создай компонент, фронтенд, frontend, React, UI, страница тренировок, лидерборд UI, график прогресса, Zustand store, форма логина, форма тренировки."
---

# IronTracker Frontend Development Guide

Экспертное руководство по проектированию и разработке пользовательского интерфейса микросервисной платформы **IronTracker**.

---

## 1. Технологический стек фронтенда
- **Среда сборки:** Node.js 20+, Vite (быстрый HMR и оптимизированный production bundle).
- **Фреймворк:** React 18+ (функциональные компоненты, хуки, StrictMode).
- **Язык:** TypeScript в строгом режиме (`"strict": true`, полный запрет типа `any`).
- **Стилизация:** Tailwind CSS + PostCSS + `clsx` / `tailwind-merge` (темная палитра *Iron Dark*).
- **Управление состоянием:** Zustand (легковесные модульные хранилища с localStorage middleware).
- **Маршрутизация:** React Router v6 (`createBrowserRouter` или `<Routes>`, защищенные маршруты `ProtectedRoute`).
- **Формы и валидация:** React Hook Form + Zod (строгие схемы валидации на клиенте).
- **Визуализация:** Recharts (графики динамики 1RM, объема тоннажа и распределения нагрузок).
- **Иконки:** `lucide-react`.
- **HTTP клиент:** Axios с интерцепторами авторизации Bearer JWT и автоматической обработки 401.

---

## 2. Структура проекта (`frontend/`)

Каталог клиентского приложения изолирован в `./frontend/` монорепозитория:

```
frontend/
├── Dockerfile                  # Multi-stage Dockerfile (Node.js builder -> Caddy/Nginx static)
├── index.html                  # HTML-шаблон с метатегами и шрифтами
├── package.json                # Зависимости и скрипты (dev, build, lint, preview)
├── postcss.config.js           # Конфигурация PostCSS
├── tailwind.config.js          # Конфигурация темы Iron Dark и цветовой палитры
├── tsconfig.json               # Строгая конфигурация TypeScript
├── vite.config.ts              # Конфигурация Vite с алиасами путей (@/)
└── src/
    ├── api/                    # Типизированные клиенты взаимодействия с микросервисами
    │   ├── client.ts           # Базовый инстанс Axios с интерцепторами Bearer JWT
    │   ├── auth.ts             # Эндпоинты Users Service (/api/v1/users/register, /login, /me)
    │   ├── workouts.ts         # Эндпоинты Workout Service (/api/v1/workouts CRUD)
    │   ├── leaderboard.ts      # Эндпоинты Leaderboard Service (/api/v1/leaderboard)
    │   └── analytics.ts        # Эндпоинты Analytics Service (/api/v1/analytics)
    ├── components/             # Переиспользуемые компоненты интерфейса
    │   ├── ui/                 # Атомарные компоненты (Button, Input, Card, Modal, Badge, Spinner)
    │   ├── workouts/           # Доменные компоненты тренировок (WorkoutCard, WorkoutForm, MetricsFields)
    │   ├── leaderboard/        # Доменные компоненты рейтинга (LeaderboardTable, UserRankCard)
    │   └── analytics/          # Графики и метрики (OneRepMaxChart, VolumeTrendChart)
    ├── layouts/                # Шаблоны страниц (MainLayout, AuthLayout, Navbar, Sidebar)
    ├── pages/                  # Страницы приложения
    │   ├── LoginPage.tsx
    │   ├── RegisterPage.tsx
    │   ├── WorkoutsPage.tsx
    │   ├── WorkoutDetailPage.tsx
    │   ├── LeaderboardPage.tsx
    │   ├── AnalyticsPage.tsx
    │   └── NotFoundPage.tsx
    ├── store/                  # Глобальные сторы состояния (Zustand)
    │   ├── useAuthStore.ts     # Состояние текущего атлета, JWT токен, методы login/logout
    │   ├── useWorkoutStore.ts  # Список тренировок, фильтры, статус загрузки
    │   └── useLeaderboardStore.ts # Турнирная таблица, личный ранг
    ├── types/                  # Типы TypeScript (строгая синхронизация с Pydantic v2 бэкенда)
    │   ├── auth.ts             # User, LoginRequest, RegisterRequest, TokenResponse
    │   ├── workout.ts          # Workout, WorkoutCreate, WorkoutUpdate, ExerciseMetrics
    │   └── leaderboard.ts      # LeaderboardEntry, UserRankResponse
    ├── hooks/                  # Пользовательские хуки (useAuth, useDebounce, useMediaQuery)
    ├── utils/                  # Утилиты (расчет 1RM, форматирование дат, cn helper)
    ├── App.tsx                 # Корневой компонент с React Router
    ├── main.tsx                # Точка входа React (createRoot)
    └── index.css               # Глобальные стили Tailwind и директивы
```

---

## 3. Синхронизация типов данных с Pydantic v2 моделями

### 3.1. Метрики упражнений (Discriminated Unions)
Бэкенд использует Pydantic v2 Discriminated Unions для поля `metrics`. Во фронтенде типы должны быть строго эквивалентны:

```typescript
// types/workout.ts
export type ExerciseType =
  | 'bench_press'
  | 'squat'
  | 'deadlift'
  | 'overhead_press'
  | 'cardio'
  | 'strength';

export interface BenchPressMetrics {
  exercise_type: 'bench_press';
  weight: number;
  sets: number;
  reps: number;
  rpe?: number;
}

export interface SquatMetrics {
  exercise_type: 'squat';
  weight: number;
  sets: number;
  reps: number;
  rpe?: number;
}

export interface DeadliftMetrics {
  exercise_type: 'deadlift';
  weight: number;
  sets: number;
  reps: number;
  rpe?: number;
}

export interface CardioMetrics {
  exercise_type: 'cardio';
  distance_km: number;
  duration_minutes: number;
  heart_rate?: number;
  calories_burned?: number;
}

export type WorkoutMetrics =
  | BenchPressMetrics
  | SquatMetrics
  | DeadliftMetrics
  | CardioMetrics;

export interface Workout {
  id: string;
  user_id: string;
  type: string;
  metrics: WorkoutMetrics;
  date: string;
  created_at: string;
  updated_at?: string;
}
```

---

## 4. Паттерны управления состоянием (Zustand)

### 4.1. Auth Store с сохранением сессии:
```typescript
// store/useAuthStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types/auth';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'irontracker-auth',
    }
  )
);
```

### 4.2. Axios интерцептор:
```typescript
// api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 5. Расчет спортивных показателей (1RM)
Для графиков аналитики используется формула Эпли (Epley formula):
$$1RM = weight \times (1 + \frac{reps}{30})$$
или формула Бржицки (Brzycki formula):
$$1RM = \frac{weight}{1.0278 - 0.0278 \times reps}$$

```typescript
// utils/fitness.ts
export function calculateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  // Epley formula rounded to 1 decimal place
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
```

---

## 6. Dockerfile для фронтенда (Multi-Stage)
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Static Server
FROM caddy:2-alpine
COPY --from=builder /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
```

---

## 7. Чек-лист качества и верификации
- [ ] TypeScript компилируется без ошибок (`tsc --noEmit`).
- [ ] ESLint не находит ошибок (`npm run lint`).
- [ ] Безопасность: Bearer токены подставляются через интерцепторы, отсутствует хардкод секретов.
- [ ] Защита от IDOR: кнопки изменения чужих записей скрыты, 403 Forbidden корректно обрабатывается.
- [ ] Адаптивность: интерфейс протестирован на разрешениях от мобильных (375px) до десктопа (1920px).
