import apiClient from './client';
import { Workout, WorkoutCreate, WorkoutUpdate } from '@/types/workout';

export interface WorkoutListParams {
  user_id?: string;
  skip?: number;
  limit?: number;
}

export const workoutsApi = {
  /**
   * Retrieve list of workouts with optional filtering and pagination.
   */
  async list(params?: WorkoutListParams): Promise<Workout[]> {
    const response = await apiClient.get<Workout[]>('/workouts', { params });
    return response.data;
  },

  /**
   * Retrieve single workout by UUID.
   */
  async get(id: string): Promise<Workout> {
    const response = await apiClient.get<Workout>(`/workouts/${id}`);
    return response.data;
  },

  /**
   * Create a new workout with validated exercise metrics.
   */
  async create(data: WorkoutCreate): Promise<Workout> {
    const response = await apiClient.post<Workout>('/workouts', data);
    return response.data;
  },

  /**
   * Update an existing workout by UUID.
   */
  async update(id: string, data: WorkoutUpdate): Promise<Workout> {
    const response = await apiClient.put<Workout>(`/workouts/${id}`, data);
    return response.data;
  },

  /**
   * Delete workout record by UUID.
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/workouts/${id}`);
  },
};

export default workoutsApi;
