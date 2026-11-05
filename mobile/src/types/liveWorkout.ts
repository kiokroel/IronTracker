import type { ExerciseCategory, MuscleGroup } from "./index";

export type RestPresetSeconds = 30 | 60 | 90 | 120 | 180 | 300;

export interface LiveWorkoutSet {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  is_warmup: boolean;
  is_completed: boolean;
  completed_at?: string | null;
}

export interface LiveWorkoutExercise {
  id: string;
  exercise_id?: string | null;
  exercise_name: string;
  exercise_type: ExerciseCategory;
  target_muscle_groups?: MuscleGroup[];
  sets: LiveWorkoutSet[];
  notes?: string | null;
}

export interface RestTimerState {
  is_active: boolean;
  is_paused: boolean;
  remaining_seconds: number;
  total_seconds: number;
}

export interface LiveWorkoutDraft {
  id: string;
  user_id?: string | null;
  title: string;
  started_at: string;
  elapsed_seconds: number;
  is_paused: boolean;
  exercises: LiveWorkoutExercise[];
  active_exercise_id?: string | null;
  rest_timer?: RestTimerState | null;
  notes?: string | null;
  updated_at: string;
}

export interface BestSetSummary {
  exercise_name: string;
  weight: number;
  reps: number;
  estimated_one_rep_max: number;
}

export interface LiveWorkoutSummary {
  duration_seconds: number;
  duration_minutes: number;
  total_tonnage: number;
  total_sets: number;
  completed_sets: number;
  exercises_count: number;
  best_sets: BestSetSummary[];
}
