export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

export type ExerciseType = "strength" | "cardio";

export interface ExerciseItem {
  id: string;
  name: string;
  muscle_group: string;
  exercise_type: ExerciseType;
  equipment?: string;
  is_custom: boolean;
}

export interface ExerciseSet {
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe?: number;
  is_warmup?: boolean;
}

export interface WorkoutSessionExercise {
  exercise_id: string;
  exercise_name: string;
  sets: ExerciseSet[];
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  title: string;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  exercises: WorkoutSessionExercise[];
  total_tonnage_kg: number;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_tonnage: number;
  rank: number;
}
