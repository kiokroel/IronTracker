export type ExerciseType =
  | 'bench_press'
  | 'benchpress'
  | 'squat'
  | 'squats'
  | 'deadlift'
  | 'treadmill'
  | 'running'
  | 'strength'
  | 'cardio';

export interface BenchPressMetrics {
  exercise_type: 'bench_press' | 'benchpress';
  weight: number;
  sets: number;
  reps: number;
  rpe?: number;
  grip_width_cm?: number;
}

export interface SquatMetrics {
  exercise_type: 'squat' | 'squats';
  weight: number;
  sets: number;
  reps: number;
  rpe?: number;
  stance?: 'narrow' | 'medium' | 'wide';
}

export interface DeadliftMetrics {
  exercise_type: 'deadlift';
  weight: number;
  sets: number;
  reps: number;
  rpe?: number;
  deadlift_style?: 'conventional' | 'sumo';
}

export interface TreadmillMetrics {
  exercise_type: 'treadmill' | 'running';
  distance_km: number;
  duration_minutes: number;
  heart_rate?: number;
  incline_percentage?: number;
  speed_kmh?: number;
  pace_min_per_km?: number;
  calories_burned?: number;
}

export interface StrengthExerciseMetrics {
  exercise_type: 'strength';
  exercise_name: string;
  weight: number;
  sets: number;
  reps: number;
  rpe?: number;
}

export interface CardioExerciseMetrics {
  exercise_type: 'cardio';
  exercise_name: string;
  distance_km: number;
  duration_minutes: number;
  heart_rate?: number;
  calories_burned?: number;
}

export type WorkoutMetrics =
  | BenchPressMetrics
  | SquatMetrics
  | DeadliftMetrics
  | TreadmillMetrics
  | StrengthExerciseMetrics
  | CardioExerciseMetrics;

export interface Workout {
  id: string;
  user_id: string;
  type: string;
  metrics: WorkoutMetrics;
  date: string;
  created_at: string;
  updated_at?: string;
}

export interface WorkoutCreate {
  type: string;
  metrics: WorkoutMetrics;
  date?: string;
  user_id?: string;
}

export interface WorkoutUpdate {
  type?: string;
  metrics?: WorkoutMetrics;
  date?: string;
}
