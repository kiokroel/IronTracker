import { describe, expect, it, vi, beforeEach } from "vitest";
import apiClient from "./client";
import {
  fetchWorkoutSessions,
  fetchWorkoutSessionById,
  createWorkoutSession,
  deleteWorkoutSession,
} from "./workouts";
import type { WorkoutSessionCreate, WorkoutSessionResponse } from "../types";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

describe("Workouts API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSession: WorkoutSessionResponse = {
    id: "session-123",
    user_id: "user-456",
    title: "Upper Body Strength",
    date: "2026-11-02T10:00:00Z",
    duration_minutes: 55,
    total_tonnage: 4200,
    notes: "Felt strong on bench press",
    exercises: [
      {
        exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_type: "strength",
        sets: [
          {
            set_number: 1,
            weight: 100,
            reps: 8,
            rpe: 8,
            is_warmup: false,
          },
          {
            set_number: 2,
            weight: 100,
            reps: 7,
            rpe: 8.5,
            is_warmup: false,
          },
        ],
      },
    ],
    created_at: "2026-11-02T11:00:00Z",
    updated_at: "2026-11-02T11:00:00Z",
  };

  describe("fetchWorkoutSessions", () => {
    it("calls GET /workout-sessions with default pagination (skip=0, limit=50)", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [mockSession],
      });

      const result = await fetchWorkoutSessions();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith("/workout-sessions", {
        params: { skip: 0, limit: 50 },
      });
      expect(result).toEqual([mockSession]);
    });

    it("calls GET /workout-sessions with custom skip and limit", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [],
      });

      const result = await fetchWorkoutSessions(20, 10);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith("/workout-sessions", {
        params: { skip: 20, limit: 10 },
      });
      expect(result).toEqual([]);
    });

    it("propagates error when GET /workout-sessions fails", async () => {
      const error = new Error("Network error");
      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(fetchWorkoutSessions()).rejects.toThrow("Network error");
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchWorkoutSessionById", () => {
    it("calls GET /workout-sessions/:id with specified session id", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockSession,
      });

      const result = await fetchWorkoutSessionById("session-123");

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith("/workout-sessions/session-123");
      expect(result).toEqual(mockSession);
    });

    it("propagates error when workout session is not found (404)", async () => {
      const error = new Error("Not Found");
      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(fetchWorkoutSessionById("session-999")).rejects.toThrow("Not Found");
      expect(apiClient.get).toHaveBeenCalledWith("/workout-sessions/session-999");
    });
  });

  describe("createWorkoutSession", () => {
    it("calls POST /workout-sessions with payload and returns created session", async () => {
      const payload: WorkoutSessionCreate = {
        title: "Evening Session",
        duration_minutes: 45,
        exercises: [
          {
            exercise_id: "ex-1",
            exercise_name: "Squats",
            exercise_type: "strength",
            sets: [
              {
                set_number: 1,
                weight: 120,
                reps: 5,
                rpe: 8,
                is_warmup: false,
              },
            ],
          },
        ],
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          ...mockSession,
          title: "Evening Session",
        },
      });

      const result = await createWorkoutSession(payload);

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith("/workout-sessions", payload);
      expect(result.title).toBe("Evening Session");
    });

    it("propagates error when POST /workout-sessions fails", async () => {
      const error = new Error("Validation Error");
      vi.mocked(apiClient.post).mockRejectedValueOnce(error);

      await expect(
        createWorkoutSession({
          title: "Invalid",
          exercises: [],
        })
      ).rejects.toThrow("Validation Error");
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteWorkoutSession", () => {
    it("calls DELETE /workout-sessions/:id with specified session id", async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: null });

      await deleteWorkoutSession("session-123");

      expect(apiClient.delete).toHaveBeenCalledTimes(1);
      expect(apiClient.delete).toHaveBeenCalledWith("/workout-sessions/session-123");
    });

    it("propagates error when DELETE /workout-sessions/:id fails", async () => {
      const error = new Error("Forbidden");
      vi.mocked(apiClient.delete).mockRejectedValueOnce(error);

      await expect(deleteWorkoutSession("session-forbidden")).rejects.toThrow("Forbidden");
      expect(apiClient.delete).toHaveBeenCalledWith("/workout-sessions/session-forbidden");
    });
  });
});
