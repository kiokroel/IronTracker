import { describe, expect, it, beforeEach } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  calculateBestSetOneRepMax,
  calculateExerciseTonnage,
  calculateSetOneRepMax,
  calculateTonnage,
  clearDraftFromStorage,
  computeLiveWorkoutSummary,
  draftToWorkoutSessionCreate,
  formatTimer,
  generateId,
  getLiveWorkoutDraftKey,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "./liveWorkout";
import type { LiveWorkoutDraft, LiveWorkoutExercise } from "../types";

describe("liveWorkout utilities", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe("generateId", () => {
    it("generates unique ids with given prefix", () => {
      const id1 = generateId("set");
      const id2 = generateId("set");
      expect(id1).toContain("set_");
      expect(id2).toContain("set_");
      expect(id1).not.toBe(id2);
    });
  });

  describe("calculateSetOneRepMax (Epley)", () => {
    it("returns 0 for non-positive weight or reps", () => {
      expect(calculateSetOneRepMax(0, 10)).toBe(0);
      expect(calculateSetOneRepMax(100, 0)).toBe(0);
      expect(calculateSetOneRepMax(-50, 5)).toBe(0);
      expect(calculateSetOneRepMax(100, -2)).toBe(0);
    });

    it("returns exact weight for 1 rep", () => {
      expect(calculateSetOneRepMax(100, 1)).toBe(100);
      expect(calculateSetOneRepMax(142.5, 1)).toBe(142.5);
    });

    it("calculates 1RM accurately for multi-rep sets", () => {
      // 100 * (1 + 10 / 30) = 133.333... -> 133.3
      expect(calculateSetOneRepMax(100, 10)).toBe(133.3);
      // 80 * (1 + 5 / 30) = 80 * (1 + 0.1666...) = 93.333... -> 93.3
      expect(calculateSetOneRepMax(80, 5)).toBe(93.3);
    });
  });

  describe("calculateExerciseTonnage and calculateTonnage", () => {
    const mockExercise: LiveWorkoutExercise = {
      id: "ex-1",
      exercise_name: "Bench Press",
      exercise_type: "strength",
      sets: [
        {
          id: "s1",
          set_number: 1,
          weight: 60,
          reps: 10,
          is_warmup: true, // Warmup: ignored
          is_completed: true,
        },
        {
          id: "s2",
          set_number: 2,
          weight: 100,
          reps: 8, // Working completed: 800
          is_warmup: false,
          is_completed: true,
        },
        {
          id: "s3",
          set_number: 3,
          weight: 100,
          reps: 6, // Working NOT completed: 600
          is_warmup: false,
          is_completed: false,
        },
      ],
    };

    it("calculates tonnage only for completed working sets by default", () => {
      const tonnage = calculateExerciseTonnage(mockExercise);
      expect(tonnage).toBe(800);
    });

    it("calculates tonnage for all working sets when onlyCompleted is false", () => {
      const tonnage = calculateExerciseTonnage(mockExercise, false);
      expect(tonnage).toBe(1400); // 800 + 600
    });

    it("calculates total session tonnage across exercises", () => {
      const ex2: LiveWorkoutExercise = {
        id: "ex-2",
        exercise_name: "Incline Dumbbell Press",
        exercise_type: "strength",
        sets: [
          {
            id: "s4",
            set_number: 1,
            weight: 30,
            reps: 10,
            is_warmup: false,
            is_completed: true,
          },
        ],
      };

      const total = calculateTonnage([mockExercise, ex2]);
      expect(total).toBe(1100); // 800 + 300
    });
  });

  describe("calculateBestSetOneRepMax", () => {
    it("returns null for exercise with no valid sets", () => {
      const emptyEx: LiveWorkoutExercise = {
        id: "ex-empty",
        exercise_name: "Squat",
        exercise_type: "strength",
        sets: [],
      };
      expect(calculateBestSetOneRepMax(emptyEx)).toBeNull();
    });

    it("picks the set with the highest estimated 1RM", () => {
      const ex: LiveWorkoutExercise = {
        id: "ex-1",
        exercise_name: "Deadlift",
        exercise_type: "strength",
        sets: [
          {
            id: "s1",
            set_number: 1,
            weight: 140,
            reps: 5, // 140 * (1 + 5/30) = 163.3
            is_warmup: false,
            is_completed: true,
          },
          {
            id: "s2",
            set_number: 2,
            weight: 160,
            reps: 3, // 160 * (1 + 3/30) = 176
            is_warmup: false,
            is_completed: true,
          },
        ],
      };

      const best = calculateBestSetOneRepMax(ex);
      expect(best).not.toBeNull();
      expect(best?.exercise_name).toBe("Deadlift");
      expect(best?.weight).toBe(160);
      expect(best?.reps).toBe(3);
      expect(best?.estimated_one_rep_max).toBe(176);
    });
  });

  describe("formatTimer", () => {
    it("formats minutes and seconds", () => {
      expect(formatTimer(0)).toBe("00:00");
      expect(formatTimer(59)).toBe("00:59");
      expect(formatTimer(65)).toBe("01:05");
      expect(formatTimer(599)).toBe("09:59");
    });

    it("formats hours, minutes, and seconds when >= 1 hour", () => {
      expect(formatTimer(3600)).toBe("01:00:00");
      expect(formatTimer(3665)).toBe("01:01:05");
    });

    it("handles negative or decimal values safely", () => {
      expect(formatTimer(-10)).toBe("00:00");
      expect(formatTimer(45.7)).toBe("00:45");
    });
  });

  describe("Draft persistence with AsyncStorage", () => {
    const mockDraft: LiveWorkoutDraft = {
      id: "w-1",
      user_id: "user-abc",
      title: "Leg Day",
      started_at: "2026-11-05T10:00:00Z",
      elapsed_seconds: 120,
      is_paused: false,
      exercises: [],
      active_exercise_id: null,
      rest_timer: null,
      updated_at: "2026-11-05T10:02:00Z",
    };

    it("generates correct storage keys", () => {
      expect(getLiveWorkoutDraftKey("user-123")).toBe(
        "irontracker_live_workout_draft_user-123"
      );
      expect(getLiveWorkoutDraftKey(null)).toBe(
        "irontracker_live_workout_draft_guest"
      );
    });

    it("saves and loads draft from storage", async () => {
      await saveDraftToStorage(mockDraft, "user-abc");
      const loaded = await loadDraftFromStorage("user-abc");

      expect(loaded).toEqual(mockDraft);
    });

    it("clears draft from storage", async () => {
      await saveDraftToStorage(mockDraft, "user-abc");
      await clearDraftFromStorage("user-abc");

      const loaded = await loadDraftFromStorage("user-abc");
      expect(loaded).toBeNull();
    });

    it("ensures strict per-user draft isolation without cross-user leakage", async () => {
      const draftA: LiveWorkoutDraft = {
        ...mockDraft,
        id: "w-user-a",
        user_id: "user-alpha",
        title: "Alpha Leg Day",
      };
      const draftB: LiveWorkoutDraft = {
        ...mockDraft,
        id: "w-user-b",
        user_id: "user-beta",
        title: "Beta Chest Day",
      };

      await saveDraftToStorage(draftA, "user-alpha");
      await saveDraftToStorage(draftB, "user-beta");

      const loadedA = await loadDraftFromStorage("user-alpha");
      const loadedB = await loadDraftFromStorage("user-beta");

      expect(loadedA?.title).toBe("Alpha Leg Day");
      expect(loadedB?.title).toBe("Beta Chest Day");

      // Clearing User A's draft does not clear User B's draft
      await clearDraftFromStorage("user-alpha");
      expect(await loadDraftFromStorage("user-alpha")).toBeNull();
      expect(await loadDraftFromStorage("user-beta")).not.toBeNull();
      expect((await loadDraftFromStorage("user-beta"))?.title).toBe("Beta Chest Day");
    });

    it("safely handles corrupted or invalid JSON in storage without throwing", async () => {
      const badKey = getLiveWorkoutDraftKey("user-corrupt");
      await AsyncStorage.setItem(badKey, "INVALID_NON_JSON_CONTENT{{{");

      const loaded = await loadDraftFromStorage("user-corrupt");
      expect(loaded).toBeNull();
    });

    it("verifies that workout draft schema contains no credentials or auth tokens", () => {
      const draftJson = JSON.stringify(mockDraft);
      expect(draftJson).not.toContain("token");
      expect(draftJson).not.toContain("password");
      expect(draftJson).not.toContain("secret");
      expect(draftJson).not.toContain("bearer");
    });
  });

  describe("computeLiveWorkoutSummary", () => {
    it("computes duration, tonnage, set counts, and best 1RM sets", () => {
      const draft: LiveWorkoutDraft = {
        id: "w-1",
        user_id: "user-1",
        title: "Chest Blast",
        started_at: "2026-11-05T10:00:00Z",
        elapsed_seconds: 3600, // 60 mins
        is_paused: false,
        exercises: [
          {
            id: "ex-1",
            exercise_name: "Bench Press",
            exercise_type: "strength",
            sets: [
              {
                id: "s1",
                set_number: 1,
                weight: 100,
                reps: 10,
                is_warmup: false,
                is_completed: true,
              },
              {
                id: "s2",
                set_number: 2,
                weight: 110,
                reps: 8,
                is_warmup: false,
                is_completed: true,
              },
            ],
          },
        ],
        updated_at: "2026-11-05T11:00:00Z",
      };

      const summary = computeLiveWorkoutSummary(draft);
      expect(summary.duration_seconds).toBe(3600);
      expect(summary.duration_minutes).toBe(60);
      expect(summary.total_sets).toBe(2);
      expect(summary.completed_sets).toBe(2);
      expect(summary.exercises_count).toBe(1);
      expect(summary.total_tonnage).toBe(100 * 10 + 110 * 8); // 1880
      expect(summary.best_sets.length).toBe(1);
      expect(summary.best_sets[0].exercise_name).toBe("Bench Press");
    });
  });

  describe("draftToWorkoutSessionCreate", () => {
    it("converts draft into WorkoutSessionCreate API payload", () => {
      const draft: LiveWorkoutDraft = {
        id: "draft-1",
        user_id: "user-1",
        title: "Full Body Heavy",
        started_at: "2026-11-05T12:00:00Z",
        elapsed_seconds: 2400, // 40 mins
        is_paused: false,
        notes: "Solid session",
        exercises: [
          {
            id: "e1",
            exercise_id: "cat-squat",
            exercise_name: "Barbell Squat",
            exercise_type: "strength",
            sets: [
              {
                id: "s1",
                set_number: 1,
                weight: 140,
                reps: 5,
                rpe: 8.5,
                is_warmup: false,
                is_completed: true,
              },
            ],
          },
        ],
        updated_at: "2026-11-05T12:40:00Z",
      };

      const payload = draftToWorkoutSessionCreate(draft);
      expect(payload.title).toBe("Full Body Heavy");
      expect(payload.duration_minutes).toBe(40);
      expect(payload.date).toBe("2026-11-05T12:00:00Z");
      expect(payload.notes).toBe("Solid session");
      expect(payload.exercises.length).toBe(1);
      expect(payload.exercises[0].exercise_name).toBe("Barbell Squat");
      expect(payload.exercises[0].sets[0].weight).toBe(140);
      expect(payload.exercises[0].sets[0].reps).toBe(5);
      expect(payload.exercises[0].sets[0].rpe).toBe(8.5);
    });

    it("preserves all sets without truncation, keeping warmup, RPE, exercise_id and notes override", () => {
      const draft: LiveWorkoutDraft = {
        id: "draft-full",
        user_id: "user-iron",
        title: "Chest & Triceps Power",
        started_at: "2026-11-05T14:00:00Z",
        elapsed_seconds: 3600, // 60 mins
        is_paused: false,
        notes: "Initial draft note",
        exercises: [
          {
            id: "ex-bench",
            exercise_id: "uuid-bench-123",
            exercise_name: "Barbell Bench Press",
            exercise_type: "strength",
            sets: [
              {
                id: "set-w1",
                set_number: 1,
                weight: 60,
                reps: 10,
                rpe: 5,
                is_warmup: true,
                is_completed: true,
              },
              {
                id: "set-w2",
                set_number: 2,
                weight: 80,
                reps: 6,
                rpe: 7,
                is_warmup: true,
                is_completed: true,
              },
              {
                id: "set-1",
                set_number: 3,
                weight: 100,
                reps: 5,
                rpe: 8.5,
                is_warmup: false,
                is_completed: true,
              },
              {
                id: "set-2",
                set_number: 4,
                weight: 100,
                reps: 5,
                rpe: 9,
                is_warmup: false,
                is_completed: true,
              },
              {
                id: "set-3",
                set_number: 5,
                weight: 100,
                reps: 4,
                rpe: 10,
                is_warmup: false,
                is_completed: true,
              },
              {
                id: "set-empty",
                set_number: 6,
                weight: 0,
                reps: 0,
                rpe: null,
                is_warmup: false,
                is_completed: false, // empty unfinished row should be excluded
              },
            ],
          },
        ],
        updated_at: "2026-11-05T15:00:00Z",
      };

      const payload = draftToWorkoutSessionCreate(
        draft,
        "Felt great, bench was strong!"
      );

      // Verify session properties
      expect(payload.title).toBe("Chest & Triceps Power");
      expect(payload.duration_minutes).toBe(60);
      expect(payload.notes).toBe("Felt great, bench was strong!");

      // Verify exercise details
      expect(payload.exercises.length).toBe(1);
      const bench = payload.exercises[0];
      expect(bench.exercise_id).toBe("uuid-bench-123");
      expect(bench.exercise_name).toBe("Barbell Bench Press");
      expect(bench.exercise_type).toBe("strength");

      // Verify all 5 completed sets are preserved without truncation (empty 6th excluded)
      expect(bench.sets.length).toBe(5);

      // Warmup set 1
      expect(bench.sets[0].set_number).toBe(1);
      expect(bench.sets[0].weight).toBe(60);
      expect(bench.sets[0].reps).toBe(10);
      expect(bench.sets[0].is_warmup).toBe(true);
      expect(bench.sets[0].rpe).toBe(5);

      // Working set 3 (100x5 @ 8.5)
      expect(bench.sets[2].set_number).toBe(3);
      expect(bench.sets[2].weight).toBe(100);
      expect(bench.sets[2].reps).toBe(5);
      expect(bench.sets[2].is_warmup).toBe(false);
      expect(bench.sets[2].rpe).toBe(8.5);

      // Working set 5 (100x4 @ 10)
      expect(bench.sets[4].set_number).toBe(5);
      expect(bench.sets[4].weight).toBe(100);
      expect(bench.sets[4].reps).toBe(4);
      expect(bench.sets[4].is_warmup).toBe(false);
      expect(bench.sets[4].rpe).toBe(10);
    });
  });
});
