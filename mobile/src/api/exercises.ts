import type { Exercise, ExerciseCreateRequest } from "../types";
import apiClient from "./client";

export interface ExerciseQueryParams {
  category?: string;
  muscle_group?: string;
  equipment?: string;
  search?: string;
  only_my_custom?: boolean;
}

export async function fetchExercises(
  params?: ExerciseQueryParams
): Promise<Exercise[]> {
  const response = await apiClient.get<Exercise[]>("/exercises", {
    params,
  });
  return response.data;
}

export async function createCustomExercise(
  payload: ExerciseCreateRequest
): Promise<Exercise> {
  const response = await apiClient.post<Exercise>("/exercises", payload);
  return response.data;
}

export async function deleteCustomExercise(exerciseId: string): Promise<void> {
  await apiClient.delete(`/exercises/${exerciseId}`);
}
