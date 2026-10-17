import { SessionExerciseType } from './workoutSession';

export interface LiveWorkoutSet {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  is_warmup: boolean;
  completed_at: string; // ISO string
}

export interface LiveWorkoutExercise {
  id: string;
  exercise_id?: string | null;
  exercise_name: string;
  exercise_type: SessionExerciseType;
  sets: LiveWorkoutSet[];
  distance_km?: number | null;
  duration_minutes?: number | null;
  heart_rate?: number | null;
  calories_burned?: number | null;
  notes?: string | null;
}

export type RestPresetSeconds = 60 | 90 | 120 | 180 | null; // null = free stopwatch

export interface LiveWorkoutDraft {
  userId: string;
  title: string;
  startedAt: string; // ISO timestamp
  notes?: string;
  exercises: LiveWorkoutExercise[];
  activeExerciseIndex: number;
  lastCompletedSetAt?: string | null;
  restTargetSeconds: number | null; // null = free stopwatch, number = target seconds
  restTimerStartedAt?: string | null; // ISO timestamp when rest started
  isRestRunning: boolean;
  restPausedElapsedSeconds?: number; // stored elapsed seconds when paused
}

export interface LiveWorkoutSummary {
  title: string;
  durationMinutes: number;
  totalTonnage: number;
  totalWorkingSetsCount: number;
  totalSetsCount: number;
  totalExercisesCount: number;
  completedAt: string;
}
