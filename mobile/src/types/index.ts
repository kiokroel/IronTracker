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

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export type ExerciseCategory = "strength" | "cardio" | "bodyweight";
export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "full_body";
export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "other";

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  target_muscle_groups: MuscleGroup[];
  equipment: Equipment;
  is_custom: boolean;
  user_id?: string | null;
  created_at: string;
}

export interface ExerciseCreateRequest {
  name: string;
  category: ExerciseCategory;
  target_muscle_groups: MuscleGroup[];
  equipment: Equipment;
}

export interface WorkoutSessionSet {
  set_number: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  is_warmup: boolean;
}

export interface WorkoutSessionExerciseItem {
  exercise_id?: string | null;
  exercise_name: string;
  exercise_type: ExerciseCategory;
  sets: WorkoutSessionSet[];
  distance_km?: number | null;
  duration_minutes?: number | null;
  heart_rate?: number | null;
  calories_burned?: number | null;
  notes?: string | null;
}

export interface WorkoutSessionResponse {
  id: string;
  user_id: string;
  title?: string | null;
  date?: string | null;
  duration_minutes?: number | null;
  exercises: WorkoutSessionExerciseItem[];
  total_tonnage: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_tonnage: number;
  rank: number;
}
