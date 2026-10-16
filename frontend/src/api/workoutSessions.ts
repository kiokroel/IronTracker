import apiClient from './client';
import {
  WorkoutSession,
  WorkoutSessionCreate,
  WorkoutSessionUpdate,
} from '@/types/workoutSession';

export interface WorkoutSessionListParams {
  user_id?: string;
  skip?: number;
  limit?: number;
}

/**
 * Retrieve list of workout sessions with optional pagination.
 */
export async function getWorkoutSessions(
  params?: WorkoutSessionListParams
): Promise<WorkoutSession[]> {
  const response = await apiClient.get<WorkoutSession[]>('/workout-sessions', { params });
  return response.data;
}

/**
 * Retrieve single workout session by UUID.
 */
export async function getWorkoutSessionById(id: string): Promise<WorkoutSession> {
  const response = await apiClient.get<WorkoutSession>(`/workout-sessions/${id}`);
  return response.data;
}

/**
 * Create a new workout session containing one or multiple exercises.
 */
export async function createWorkoutSession(
  data: WorkoutSessionCreate
): Promise<WorkoutSession> {
  const response = await apiClient.post<WorkoutSession>('/workout-sessions', data);
  return response.data;
}

/**
 * Update an existing workout session by UUID.
 */
export async function updateWorkoutSession(
  id: string,
  data: WorkoutSessionUpdate
): Promise<WorkoutSession> {
  const response = await apiClient.put<WorkoutSession>(`/workout-sessions/${id}`, data);
  return response.data;
}

/**
 * Delete a workout session by UUID.
 */
export async function deleteWorkoutSession(id: string): Promise<void> {
  await apiClient.delete(`/workout-sessions/${id}`);
}

export const workoutSessionsApi = {
  list: getWorkoutSessions,
  get: getWorkoutSessionById,
  create: createWorkoutSession,
  update: updateWorkoutSession,
  delete: deleteWorkoutSession,
  getWorkoutSessions,
  getWorkoutSessionById,
  createWorkoutSession,
  updateWorkoutSession,
  deleteWorkoutSession,
};

export default workoutSessionsApi;
