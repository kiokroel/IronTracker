import apiClient from './client';
import { Workout, WorkoutCreate, WorkoutUpdate } from '@/types/workout';

export interface WorkoutListParams {
  user_id?: string;
  skip?: number;
  limit?: number;
}

/**
 * Retrieve list of workouts with optional filtering and pagination.
 */
export async function getWorkouts(params?: WorkoutListParams): Promise<Workout[]> {
  const response = await apiClient.get<Workout[]>('/workouts', { params });
  return response.data;
}

/**
 * Retrieve single workout by UUID.
 */
export async function getWorkoutById(id: string): Promise<Workout> {
  const response = await apiClient.get<Workout>(`/workouts/${id}`);
  return response.data;
}

/**
 * Create a new workout with validated exercise metrics.
 */
export async function createWorkout(data: WorkoutCreate): Promise<Workout> {
  const response = await apiClient.post<Workout>('/workouts', data);
  return response.data;
}

/**
 * Update an existing workout by UUID.
 */
export async function updateWorkout(id: string, data: WorkoutUpdate): Promise<Workout> {
  const response = await apiClient.put<Workout>(`/workouts/${id}`, data);
  return response.data;
}

/**
 * Delete workout record by UUID.
 */
export async function deleteWorkout(id: string): Promise<void> {
  await apiClient.delete(`/workouts/${id}`);
}

export const workoutsApi = {
  list: getWorkouts,
  get: getWorkoutById,
  create: createWorkout,
  update: updateWorkout,
  delete: deleteWorkout,
  getWorkouts,
  getWorkoutById,
  createWorkout,
  updateWorkout,
  deleteWorkout,
};

export default workoutsApi;
