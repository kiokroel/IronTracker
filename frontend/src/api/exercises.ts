import apiClient from './client';
import { Exercise, ExerciseCreate, ExerciseFilters } from '@/types/exercise';

export interface ExerciseListParams extends ExerciseFilters {
  skip?: number;
  limit?: number;
}

/**
 * Retrieve accessible library and custom user exercises.
 */
export async function getExercises(params?: ExerciseListParams): Promise<Exercise[]> {
  const response = await apiClient.get<Exercise[]>('/exercises', { params });
  return response.data;
}

/**
 * Retrieve single exercise by UUID.
 */
export async function getExerciseById(id: string): Promise<Exercise> {
  const response = await apiClient.get<Exercise>(`/exercises/${id}`);
  return response.data;
}

/**
 * Create a new custom user exercise.
 */
export async function createCustomExercise(data: ExerciseCreate): Promise<Exercise> {
  const response = await apiClient.post<Exercise>('/exercises', data);
  return response.data;
}

/**
 * Delete athlete's custom exercise by UUID.
 */
export async function deleteCustomExercise(id: string): Promise<void> {
  await apiClient.delete(`/exercises/${id}`);
}

export const exercisesApi = {
  list: getExercises,
  get: getExerciseById,
  create: createCustomExercise,
  delete: deleteCustomExercise,
  getExercises,
  getExerciseById,
  createCustomExercise,
  deleteCustomExercise,
};

export default exercisesApi;
