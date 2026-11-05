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

export interface WorkoutSessionCreate {
  title?: string | null;
  date?: string | null;
  duration_minutes?: number | null;
  exercises: WorkoutSessionExerciseItem[];
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

export type LeaderboardPeriod = "all" | "month" | "week";

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  score: number;
  username?: string;
  total_tonnage?: number;
}

export interface LeaderboardResponse {
  metric: string;
  total_entries: number;
  entries: LeaderboardEntry[];
}

export interface UserRankResponse {
  user_id: string;
  rank: number | null;
  score: number;
}

export interface OneRepMaxPoint {
  date: string;
  formattedDate: string;
  weight: number;
  reps: number;
  oneRepMax: number;
  formulaBreakdown: {
    epley: number;
    brzycki: number;
    lander: number;
    wathan: number;
    average: number;
  };
  exerciseName: string;
}

export interface VolumeTrendPoint {
  id: string;
  date: string;
  formattedDate: string;
  volume: number;
  exerciseCount: number;
  durationMinutes?: number | null;
  title?: string | null;
}

export interface PersonalRecordsSummary {
  bestOneRepMax: {
    exerciseName: string;
    weight: number;
    reps: number;
    oneRepMax: number;
    date: string;
  } | null;
  maxWeightLifted: {
    exerciseName: string;
    weight: number;
    reps: number;
    date: string;
  } | null;
  maxSessionTonnage: {
    tonnage: number;
    date: string;
    title: string;
  } | null;
  totalAllTimeTonnage: number;
  totalSessionsCount: number;
  totalWorkingSetsCount: number;
}

export * from "./liveWorkout";
