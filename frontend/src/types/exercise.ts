export type ExerciseCategory = 'strength' | 'cardio' | 'bodyweight';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'full_body';

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'other';

export interface Exercise {
  id: string;
  user_id?: string | null;
  name: string;
  category: ExerciseCategory;
  target_muscle_groups: MuscleGroup[];
  equipment: EquipmentType;
  is_custom: boolean;
  created_at: string;
}

export interface ExerciseCreate {
  name: string;
  category: ExerciseCategory;
  target_muscle_groups: MuscleGroup[];
  equipment: EquipmentType;
}

export interface ExerciseFilters {
  category?: ExerciseCategory;
  muscle_group?: MuscleGroup;
  equipment?: EquipmentType;
  search?: string;
  only_my_custom?: boolean;
}
