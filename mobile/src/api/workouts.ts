import type { WorkoutSessionCreate, WorkoutSessionResponse } from "../types";
import apiClient from "./client";

export async function fetchWorkoutSessions(
  skip = 0,
  limit = 50
): Promise<WorkoutSessionResponse[]> {
  const response = await apiClient.get<WorkoutSessionResponse[]>(
    "/workout-sessions",
    {
      params: { skip, limit },
    }
  );
  return response.data;
}

export async function fetchWorkoutSessionById(
  id: string
): Promise<WorkoutSessionResponse> {
  const response = await apiClient.get<WorkoutSessionResponse>(
    `/workout-sessions/${id}`
  );
  return response.data;
}

export async function createWorkoutSession(
  data: WorkoutSessionCreate
): Promise<WorkoutSessionResponse> {
  const response = await apiClient.post<WorkoutSessionResponse>(
    "/workout-sessions",
    data
  );
  return response.data;
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  await apiClient.delete(`/workout-sessions/${id}`);
}
