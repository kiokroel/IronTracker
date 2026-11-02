import { describe, expect, it, vi, beforeEach } from "vitest";
import apiClient from "./client";
import {
  fetchExercises,
  createCustomExercise,
  deleteCustomExercise,
} from "./exercises";
import type { ExerciseCreateRequest } from "../types";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

describe("Exercises API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchExercises calls GET /exercises with query parameters", async () => {
    const mockExercises = [
      {
        id: "ex-1",
        name: "Bench Press",
        category: "strength",
        target_muscle_groups: ["chest", "triceps"],
        is_custom: false,
      },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockExercises });

    const result = await fetchExercises({
      muscle_group: "chest",
      search: "bench",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/exercises", {
      params: { muscle_group: "chest", search: "bench" },
    });
    expect(result).toEqual(mockExercises);
  });

  it("createCustomExercise calls POST /exercises with payload", async () => {
    const payload: ExerciseCreateRequest = {
      name: "Custom Cable Fly",
      category: "strength",
      target_muscle_groups: ["chest"],
      equipment: "cable",
    };
    const created = { id: "ex-custom-1", ...payload, is_custom: true };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: created });

    const result = await createCustomExercise(payload);

    expect(apiClient.post).toHaveBeenCalledWith("/exercises", payload);
    expect(result).toEqual(created);
  });

  it("deleteCustomExercise calls DELETE /exercises/:id", async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: null });

    await deleteCustomExercise("ex-custom-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/exercises/ex-custom-1");
  });
});

