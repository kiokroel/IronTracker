import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as KeepAwake from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useLiveWorkoutStore } from "./useLiveWorkoutStore";

describe("useLiveWorkoutStore", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    vi.clearAllMocks();
    useLiveWorkoutStore.setState({
      draft: null,
      isActive: false,
      isPaused: false,
      restTimer: null,
      summary: null,
      isLoading: false,
      error: null,
    });
  });

  describe("Workout Lifecycle", () => {
    it("starts a new workout, activates keep-awake, and saves draft", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Morning Blast", "user-42");

      const state = useLiveWorkoutStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.isPaused).toBe(false);
      expect(state.draft?.title).toBe("Morning Blast");
      expect(state.draft?.user_id).toBe("user-42");

      const raw = await AsyncStorage.getItem(
        "irontracker_live_workout_draft_user-42"
      );
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!).title).toBe("Morning Blast");
    });

    it("pauses and resumes workout", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Test Pause", "user-42");

      await store.pauseWorkout();
      expect(useLiveWorkoutStore.getState().isPaused).toBe(true);
      expect(useLiveWorkoutStore.getState().draft?.is_paused).toBe(true);

      await store.resumeWorkout();
      expect(useLiveWorkoutStore.getState().isPaused).toBe(false);
      expect(useLiveWorkoutStore.getState().draft?.is_paused).toBe(false);
    });

    it("cancels workout and purges storage draft", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Canceled Workout", "user-42");
      await store.cancelWorkout();

      const state = useLiveWorkoutStore.getState();
      expect(state.isActive).toBe(false);
      expect(state.draft).toBeNull();

      const raw = await AsyncStorage.getItem(
        "irontracker_live_workout_draft_user-42"
      );
      expect(raw).toBeNull();
    });

    it("finishes workout, generates summary, and preserves draft until clearDraft", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Chest Workout", "user-42");

      store.addExercise({ name: "Bench Press", category: "strength" });
      const exId = useLiveWorkoutStore.getState().draft!.exercises[0].id;
      const setId = useLiveWorkoutStore.getState().draft!.exercises[0].sets[0].id;

      store.updateSet(exId, setId, { weight: 100, reps: 10 });
      await store.completeSet(exId, setId, 0); // complete without rest

      const summary = await store.finishWorkout();

      expect(summary).not.toBeNull();
      expect(summary?.total_tonnage).toBe(1000);
      expect(summary?.completed_sets).toBe(1);
      expect(summary?.exercises_count).toBe(1);

      expect(useLiveWorkoutStore.getState().isActive).toBe(false);
      // Draft is preserved in memory and storage so network retries work
      expect(useLiveWorkoutStore.getState().draft).not.toBeNull();
      const rawBefore = await AsyncStorage.getItem(
        "irontracker_live_workout_draft_user-42"
      );
      expect(rawBefore).not.toBeNull();
      expect(useLiveWorkoutStore.getState().summary).toEqual(summary);

      // Now clear draft explicitly upon backend confirmation
      await store.clearDraft("user-42");
      expect(useLiveWorkoutStore.getState().draft).toBeNull();
      const rawAfter = await AsyncStorage.getItem(
        "irontracker_live_workout_draft_user-42"
      );
      expect(rawAfter).toBeNull();
    });

    it("restores active draft from AsyncStorage", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Saved Session", "user-123");
      store.addExercise({ name: "Pull-ups", category: "bodyweight" });

      // Reset store in-memory state
      useLiveWorkoutStore.setState({ draft: null, isActive: false });

      // Restore
      await useLiveWorkoutStore.getState().restoreDraft("user-123");

      const state = useLiveWorkoutStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.draft?.title).toBe("Saved Session");
      expect(state.draft?.exercises.length).toBe(1);
    });

    it("handles KeepAwake errors gracefully without failing workout lifecycle", async () => {
      vi.spyOn(KeepAwake, "activateKeepAwakeAsync").mockRejectedValueOnce(
        new Error("KeepAwake not supported")
      );
      vi.spyOn(KeepAwake, "deactivateKeepAwake").mockImplementationOnce(() => {
        throw new Error("KeepAwake release failed");
      });

      const store = useLiveWorkoutStore.getState();
      // Should not throw
      await expect(store.startWorkout("Resilient Workout", "user-resilient")).resolves.not.toThrow();
      expect(useLiveWorkoutStore.getState().isActive).toBe(true);

      // Should not throw on finish
      await expect(store.finishWorkout()).resolves.not.toThrow();
      expect(useLiveWorkoutStore.getState().isActive).toBe(false);
    });

    it("handles storage restoration error gracefully", async () => {
      vi.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(
        new Error("AsyncStorage IO Error")
      );

      const store = useLiveWorkoutStore.getState();
      await store.restoreDraft("user-err");

      const state = useLiveWorkoutStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isActive).toBe(false);
    });
  });

  describe("Exercises & Sets Management", () => {
    it("adds exercises with initial set and handles active exercise selection", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Legs", "user-1");

      store.addExercise({ name: "Squats", category: "strength" });
      let draft = useLiveWorkoutStore.getState().draft!;
      expect(draft.exercises.length).toBe(1);
      expect(draft.exercises[0].exercise_name).toBe("Squats");
      expect(draft.exercises[0].sets.length).toBe(1);
      expect(draft.active_exercise_id).toBe(draft.exercises[0].id);

      store.addExercise({ name: "Leg Press", category: "strength" });
      draft = useLiveWorkoutStore.getState().draft!;
      expect(draft.exercises.length).toBe(2);
      expect(draft.active_exercise_id).toBe(draft.exercises[1].id);
    });

    it("removes exercise and updates active_exercise_id", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Session", "user-1");

      store.addExercise({ name: "Ex 1" });
      store.addExercise({ name: "Ex 2" });

      const ex1Id = useLiveWorkoutStore.getState().draft!.exercises[0].id;
      const ex2Id = useLiveWorkoutStore.getState().draft!.exercises[1].id;

      store.removeExercise(ex2Id);
      const draft = useLiveWorkoutStore.getState().draft!;
      expect(draft.exercises.length).toBe(1);
      expect(draft.active_exercise_id).toBe(ex1Id);
    });

    it("adds sets prefilled with previous set values", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Workout", "user-1");

      store.addExercise({ name: "Bench" });
      const exId = useLiveWorkoutStore.getState().draft!.exercises[0].id;
      const set1Id = useLiveWorkoutStore.getState().draft!.exercises[0].sets[0].id;

      store.updateSet(exId, set1Id, { weight: 80, reps: 8 });
      store.addSet(exId);

      const exercise = useLiveWorkoutStore.getState().draft!.exercises[0];
      expect(exercise.sets.length).toBe(2);
      expect(exercise.sets[1].set_number).toBe(2);
      expect(exercise.sets[1].weight).toBe(80);
      expect(exercise.sets[1].reps).toBe(8);
      expect(exercise.sets[1].is_completed).toBe(false);
    });

    it("removes sets and renumbers set_numbers", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Workout", "user-1");

      store.addExercise({ name: "Bench" });
      const exId = useLiveWorkoutStore.getState().draft!.exercises[0].id;
      store.addSet(exId);
      store.addSet(exId);

      let exercise = useLiveWorkoutStore.getState().draft!.exercises[0];
      expect(exercise.sets.length).toBe(3);

      const set2Id = exercise.sets[1].id;
      store.removeSet(exId, set2Id);

      exercise = useLiveWorkoutStore.getState().draft!.exercises[0];
      expect(exercise.sets.length).toBe(2);
      expect(exercise.sets[0].set_number).toBe(1);
      expect(exercise.sets[1].set_number).toBe(2);
    });

    it("completes set, marks time and triggers rest timer with haptics", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Workout", "user-1");

      store.addExercise({ name: "Curl" });
      const exId = useLiveWorkoutStore.getState().draft!.exercises[0].id;
      const setId = useLiveWorkoutStore.getState().draft!.exercises[0].sets[0].id;

      await store.completeSet(exId, setId, 60);

      const setItem = useLiveWorkoutStore.getState().draft!.exercises[0].sets[0];
      expect(setItem.is_completed).toBe(true);
      expect(setItem.completed_at).toBeDefined();

      const timer = useLiveWorkoutStore.getState().restTimer;
      expect(timer).not.toBeNull();
      expect(timer?.is_active).toBe(true);
      expect(timer?.remaining_seconds).toBe(60);
    });

    it("uncompletes set", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Workout", "user-1");

      store.addExercise({ name: "Curl" });
      const exId = useLiveWorkoutStore.getState().draft!.exercises[0].id;
      const setId = useLiveWorkoutStore.getState().draft!.exercises[0].sets[0].id;

      await store.completeSet(exId, setId, 0);
      store.uncompleteSet(exId, setId);

      const setItem = useLiveWorkoutStore.getState().draft!.exercises[0].sets[0];
      expect(setItem.is_completed).toBe(false);
      expect(setItem.completed_at).toBeNull();
    });
  });

  describe("Rest Timer controls & tick", () => {
    it("starts, pauses, resumes, and adds rest time", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Workout", "user-1");

      store.startRest(90);
      expect(useLiveWorkoutStore.getState().restTimer?.remaining_seconds).toBe(90);

      store.pauseRest();
      expect(useLiveWorkoutStore.getState().restTimer?.is_paused).toBe(true);

      store.resumeRest();
      expect(useLiveWorkoutStore.getState().restTimer?.is_paused).toBe(false);

      store.addRestTime(30);
      expect(useLiveWorkoutStore.getState().restTimer?.remaining_seconds).toBe(120);

      store.skipRest();
      expect(useLiveWorkoutStore.getState().restTimer).toBeNull();
    });

    it("ticks rest timer down to 0 and auto-clears", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Workout", "user-1");

      store.startRest(2);
      expect(useLiveWorkoutStore.getState().restTimer?.remaining_seconds).toBe(2);

      store.tickRest();
      expect(useLiveWorkoutStore.getState().restTimer?.remaining_seconds).toBe(1);

      store.tickRest();
      expect(useLiveWorkoutStore.getState().restTimer).toBeNull();
    });

    it("ticks elapsed workout seconds", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Workout", "user-1");

      expect(useLiveWorkoutStore.getState().draft?.elapsed_seconds).toBe(0);
      store.tickElapsed();
      store.tickElapsed();
      expect(useLiveWorkoutStore.getState().draft?.elapsed_seconds).toBe(2);

      await store.pauseWorkout();
      store.tickElapsed();
      expect(useLiveWorkoutStore.getState().draft?.elapsed_seconds).toBe(2);
    });
  });

  describe("Offline Resilience & Backend Sync Flow", () => {
    it("preserves draft on network failure and clears strictly upon successful sync", async () => {
      const store = useLiveWorkoutStore.getState();
      await store.startWorkout("Heavy Deadlift Session", "user-resilience");

      store.addExercise({
        id: "ex-dl-uuid",
        name: "Conventional Deadlift",
        category: "strength",
      });

      const ex = useLiveWorkoutStore.getState().draft!.exercises[0];
      store.updateSet(ex.id, ex.sets[0].id, {
        weight: 180,
        reps: 5,
        rpe: 8.5,
        is_warmup: false,
      });
      await store.completeSet(ex.id, ex.sets[0].id, 0);

      // Finish workout
      const summary = await store.finishWorkout();
      expect(summary).not.toBeNull();
      expect(summary?.total_tonnage).toBe(900);

      // Verify draft is preserved locally despite finishWorkout
      expect(useLiveWorkoutStore.getState().draft).not.toBeNull();
      const storedBeforeSync = await AsyncStorage.getItem(
        "irontracker_live_workout_draft_user-resilience"
      );
      expect(storedBeforeSync).not.toBeNull();

      // Simulate network failure during first save attempt
      const simulateSync = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error("Network unreachable (gym basement)");
        }
        await store.clearDraft("user-resilience");
      };

      // 1. Network fails: draft remains intact
      await expect(simulateSync(true)).rejects.toThrow("Network unreachable");
      expect(useLiveWorkoutStore.getState().draft).not.toBeNull();
      const storedAfterFailure = await AsyncStorage.getItem(
        "irontracker_live_workout_draft_user-resilience"
      );
      expect(storedAfterFailure).not.toBeNull();

      // 2. Network restored: save succeeds and clearDraft removes draft
      await expect(simulateSync(false)).resolves.not.toThrow();
      expect(useLiveWorkoutStore.getState().draft).toBeNull();
      const storedAfterSuccess = await AsyncStorage.getItem(
        "irontracker_live_workout_draft_user-resilience"
      );
      expect(storedAfterSuccess).toBeNull();
    });
  });
});
