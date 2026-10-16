export interface WorkoutSessionSet {
  set_number: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  is_warmup?: boolean;
}

export type SessionExerciseType = 'strength' | 'cardio' | 'bodyweight';

export interface WorkoutSessionExerciseItem {
  exercise_id?: string | null;
  exercise_name: string;
  exercise_type: SessionExerciseType;
  sets: WorkoutSessionSet[];
  distance_km?: number | null;
  duration_minutes?: number | null;
  heart_rate?: number | null;
  calories_burned?: number | null;
  notes?: string | null;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  title?: string | null;
  date?: string | null;
  total_tonnage: number;
  duration_minutes?: number | null;
  exercises: WorkoutSessionExerciseItem[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSessionCreate {
  title?: string | null;
  date?: string | null;
  duration_minutes?: number | null;
  exercises: WorkoutSessionExerciseItem[];
  notes?: string | null;
}

export interface WorkoutSessionUpdate {
  title?: string | null;
  date?: string | null;
  duration_minutes?: number | null;
  exercises?: WorkoutSessionExerciseItem[];
  notes?: string | null;
}

/**
 * Calculate total working tonnage (excluding warmup) on client side
 */
export function calculateClientSessionTonnage(exercises: WorkoutSessionExerciseItem[]): number {
  let total = 0;
  for (const ex of exercises) {
    if (ex.exercise_type === 'strength' || ex.exercise_type === 'bodyweight') {
      for (const s of ex.sets) {
        if (!s.is_warmup && s.weight > 0 && s.reps > 0) {
          total += s.weight * s.reps;
        }
      }
    }
  }
  return Math.round(total * 100) / 100;
}
