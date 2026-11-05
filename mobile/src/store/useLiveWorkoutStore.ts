import * as KeepAwake from "expo-keep-awake";
import { create } from "zustand";
import {
  feedbackService,
  playRestCompleteSound,
  triggerRestFinishedHaptic,
  triggerSetCompletedHaptic,
} from "../services/feedback";
import type {
  ExerciseCategory,
  LiveWorkoutDraft,
  LiveWorkoutExercise,
  LiveWorkoutSet,
  LiveWorkoutSummary,
  MuscleGroup,
  RestTimerState,
} from "../types";
import {
  clearDraftFromStorage,
  computeLiveWorkoutSummary,
  generateId,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "../utils/liveWorkout";

const KEEP_AWAKE_TAG = "live-workout-session";

async function safeActivateKeepAwake(): Promise<void> {
  try {
    if (KeepAwake && typeof KeepAwake.activateKeepAwakeAsync === "function") {
      await KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    }
  } catch (err) {
    // Keep awake unavailable
  }
}

async function safeDeactivateKeepAwake(): Promise<void> {
  try {
    if (KeepAwake && typeof KeepAwake.deactivateKeepAwake === "function") {
      await KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG);
    }
  } catch (err) {
    // Keep awake unavailable
  }
}

export interface LiveWorkoutState {
  draft: LiveWorkoutDraft | null;
  isActive: boolean;
  isPaused: boolean;
  restTimer: RestTimerState | null;
  summary: LiveWorkoutSummary | null;
  isLoading: boolean;
  error: string | null;

  // Session lifecycle
  restoreDraft: (userId?: string | null) => Promise<void>;
  startWorkout: (title?: string, userId?: string | null) => Promise<void>;
  pauseWorkout: () => Promise<void>;
  resumeWorkout: () => Promise<void>;
  cancelWorkout: () => Promise<void>;
  finishWorkout: () => Promise<LiveWorkoutSummary | null>;
  clearDraft: (userId?: string | null) => Promise<void>;
  clearSummary: () => void;

  // Exercises
  addExercise: (exercise: {
    id?: string;
    name: string;
    category?: ExerciseCategory;
    target_muscle_groups?: MuscleGroup[];
  }) => void;
  removeExercise: (exerciseId: string) => void;
  setActiveExercise: (exerciseId: string) => void;

  // Sets
  addSet: (exerciseId: string, initialValues?: Partial<LiveWorkoutSet>) => void;
  updateSet: (
    exerciseId: string,
    setId: string,
    updates: Partial<LiveWorkoutSet>
  ) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  completeSet: (
    exerciseId: string,
    setId: string,
    restSeconds?: number
  ) => Promise<void>;
  uncompleteSet: (exerciseId: string, setId: string) => void;

  // Rest Timer
  startRest: (seconds: number) => void;
  pauseRest: () => void;
  resumeRest: () => void;
  addRestTime: (seconds: number) => void;
  skipRest: () => void;
  tickRest: () => void;

  // Global duration tick
  tickElapsed: () => void;
}

export const useLiveWorkoutStore = create<LiveWorkoutState>((set, get) => ({
  draft: null,
  isActive: false,
  isPaused: false,
  restTimer: null,
  summary: null,
  isLoading: false,
  error: null,

  restoreDraft: async (userId?: string | null) => {
    set({ isLoading: true });
    try {
      const storedDraft = await loadDraftFromStorage(userId);
      if (storedDraft) {
        set({
          draft: storedDraft,
          isActive: true,
          isPaused: storedDraft.is_paused,
          restTimer: storedDraft.rest_timer || null,
          isLoading: false,
        });
        if (!storedDraft.is_paused) {
          await safeActivateKeepAwake();
        }
      } else {
        set({ isLoading: false });
      }
    } catch (err: unknown) {
      set({
        isLoading: false,
        error: "Не удалось восстановить сохраненную тренировку",
      });
    }
  },

  startWorkout: async (title?: string, userId?: string | null) => {
    const newDraft: LiveWorkoutDraft = {
      id: generateId("workout"),
      user_id: userId || null,
      title: title || `Тренировка ${new Date().toLocaleDateString("ru-RU")}`,
      started_at: new Date().toISOString(),
      elapsed_seconds: 0,
      is_paused: false,
      exercises: [],
      active_exercise_id: null,
      rest_timer: null,
      updated_at: new Date().toISOString(),
    };

    set({
      draft: newDraft,
      isActive: true,
      isPaused: false,
      restTimer: null,
      summary: null,
      error: null,
    });

    await safeActivateKeepAwake();
    await saveDraftToStorage(newDraft, userId);
  },

  pauseWorkout: async () => {
    const { draft } = get();
    if (!draft) return;

    const updated: LiveWorkoutDraft = {
      ...draft,
      is_paused: true,
      updated_at: new Date().toISOString(),
    };

    set({
      draft: updated,
      isPaused: true,
    });

    await safeDeactivateKeepAwake();
    await saveDraftToStorage(updated, draft.user_id);
  },

  resumeWorkout: async () => {
    const { draft } = get();
    if (!draft) return;

    const updated: LiveWorkoutDraft = {
      ...draft,
      is_paused: false,
      updated_at: new Date().toISOString(),
    };

    set({
      draft: updated,
      isPaused: false,
    });

    await safeActivateKeepAwake();
    await saveDraftToStorage(updated, draft.user_id);
  },

  cancelWorkout: async () => {
    const { draft } = get();
    const userId = draft?.user_id;

    set({
      draft: null,
      isActive: false,
      isPaused: false,
      restTimer: null,
      summary: null,
      error: null,
    });

    await safeDeactivateKeepAwake();
    await clearDraftFromStorage(userId);
  },

  finishWorkout: async () => {
    const { draft } = get();
    if (!draft) return null;

    const summary = computeLiveWorkoutSummary(draft);

    set({
      // Keep draft in state so that draftToWorkoutSessionCreate has access to all completed sets
      isActive: false,
      isPaused: false,
      restTimer: null,
      summary,
    });

    await safeDeactivateKeepAwake();
    // Do NOT delete draft from AsyncStorage here!
    // The draft is safely kept in AsyncStorage until server confirmation (HTTP 201) via clearDraft().
    return summary;
  },

  clearDraft: async (userId?: string | null) => {
    const { draft } = get();
    const targetUserId = userId ?? draft?.user_id;

    set({
      draft: null,
      isActive: false,
      isPaused: false,
      restTimer: null,
      summary: null,
      error: null,
    });

    await safeDeactivateKeepAwake();
    await clearDraftFromStorage(targetUserId);
  },

  clearSummary: () => set({ summary: null }),

  addExercise: (exercise) => {
    const { draft } = get();
    if (!draft) return;

    const exerciseId = generateId("ex");
    const newExercise: LiveWorkoutExercise = {
      id: exerciseId,
      exercise_id: exercise.id || null,
      exercise_name: exercise.name,
      exercise_type: exercise.category || "strength",
      target_muscle_groups: exercise.target_muscle_groups || [],
      sets: [
        {
          id: generateId("set"),
          set_number: 1,
          weight: 0,
          reps: 0,
          rpe: null,
          is_warmup: false,
          is_completed: false,
          completed_at: null,
        },
      ],
    };

    const updated: LiveWorkoutDraft = {
      ...draft,
      exercises: [...draft.exercises, newExercise],
      active_exercise_id: exerciseId,
      updated_at: new Date().toISOString(),
    };

    set({ draft: updated });
    saveDraftToStorage(updated, draft.user_id);
  },

  removeExercise: (exerciseId: string) => {
    const { draft } = get();
    if (!draft) return;

    const updatedExercises = draft.exercises.filter((ex) => ex.id !== exerciseId);
    let newActiveId = draft.active_exercise_id;

    if (newActiveId === exerciseId) {
      newActiveId = updatedExercises.length > 0 ? updatedExercises[0].id : null;
    }

    const updated: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
      active_exercise_id: newActiveId,
      updated_at: new Date().toISOString(),
    };

    set({ draft: updated });
    saveDraftToStorage(updated, draft.user_id);
  },

  setActiveExercise: (exerciseId: string) => {
    const { draft } = get();
    if (!draft) return;

    const updated: LiveWorkoutDraft = {
      ...draft,
      active_exercise_id: exerciseId,
      updated_at: new Date().toISOString(),
    };

    set({ draft: updated });
  },

  addSet: (exerciseId: string, initialValues?: Partial<LiveWorkoutSet>) => {
    const { draft } = get();
    if (!draft) return;

    const exercise = draft.exercises.find((ex) => ex.id === exerciseId);
    if (!exercise) return;

    const lastSet =
      exercise.sets.length > 0
        ? exercise.sets[exercise.sets.length - 1]
        : null;

    const newSet: LiveWorkoutSet = {
      id: generateId("set"),
      set_number: exercise.sets.length + 1,
      weight: initialValues?.weight ?? (lastSet ? lastSet.weight : 0),
      reps: initialValues?.reps ?? (lastSet ? lastSet.reps : 0),
      rpe: initialValues?.rpe ?? null,
      is_warmup: initialValues?.is_warmup ?? false,
      is_completed: false,
      completed_at: null,
    };

    const updatedExercises = draft.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: [...ex.sets, newSet],
      };
    });

    const updated: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
      updated_at: new Date().toISOString(),
    };

    set({ draft: updated });
    saveDraftToStorage(updated, draft.user_id);
  },

  updateSet: (exerciseId, setId, updates) => {
    const { draft } = get();
    if (!draft) return;

    const updatedExercises = draft.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s)),
      };
    });

    const updated: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
      updated_at: new Date().toISOString(),
    };

    set({ draft: updated });
    saveDraftToStorage(updated, draft.user_id);
  },

  removeSet: (exerciseId, setId) => {
    const { draft } = get();
    if (!draft) return;

    const updatedExercises = draft.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      const filtered = ex.sets.filter((s) => s.id !== setId);
      // Re-number remaining sets
      const renumbered = filtered.map((s, idx) => ({
        ...s,
        set_number: idx + 1,
      }));
      return {
        ...ex,
        sets: renumbered,
      };
    });

    const updated: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
      updated_at: new Date().toISOString(),
    };

    set({ draft: updated });
    saveDraftToStorage(updated, draft.user_id);
  },

  completeSet: async (exerciseId, setId, restSeconds = 90) => {
    const { draft, startRest } = get();
    if (!draft) return;

    const now = new Date().toISOString();
    const updatedExercises = draft.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s) =>
          s.id === setId
            ? { ...s, is_completed: true, completed_at: now }
            : s
        ),
      };
    });

    const updated: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
      updated_at: now,
    };

    set({ draft: updated });

    // Haptic feedback for finishing set
    await triggerSetCompletedHaptic();

    // Auto-launch rest timer
    if (restSeconds > 0) {
      startRest(restSeconds);
    } else {
      await saveDraftToStorage(updated, draft.user_id);
    }
  },

  uncompleteSet: (exerciseId, setId) => {
    const { draft } = get();
    if (!draft) return;

    const updatedExercises = draft.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s) =>
          s.id === setId ? { ...s, is_completed: false, completed_at: null } : s
        ),
      };
    });

    const updated: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
      updated_at: new Date().toISOString(),
    };

    set({ draft: updated });
    saveDraftToStorage(updated, draft.user_id);
  },

  startRest: (seconds: number) => {
    const { draft } = get();
    const newTimer: RestTimerState = {
      is_active: true,
      is_paused: false,
      remaining_seconds: seconds,
      total_seconds: seconds,
    };

    if (draft) {
      const updated: LiveWorkoutDraft = {
        ...draft,
        rest_timer: newTimer,
        updated_at: new Date().toISOString(),
      };
      set({ draft: updated, restTimer: newTimer });
      saveDraftToStorage(updated, draft.user_id);
    } else {
      set({ restTimer: newTimer });
    }
  },

  pauseRest: () => {
    const { draft, restTimer } = get();
    if (!restTimer) return;

    const updatedTimer: RestTimerState = {
      ...restTimer,
      is_paused: true,
    };

    if (draft) {
      const updatedDraft: LiveWorkoutDraft = {
        ...draft,
        rest_timer: updatedTimer,
        updated_at: new Date().toISOString(),
      };
      set({ draft: updatedDraft, restTimer: updatedTimer });
      saveDraftToStorage(updatedDraft, draft.user_id);
    } else {
      set({ restTimer: updatedTimer });
    }
  },

  resumeRest: () => {
    const { draft, restTimer } = get();
    if (!restTimer) return;

    const updatedTimer: RestTimerState = {
      ...restTimer,
      is_paused: false,
    };

    if (draft) {
      const updatedDraft: LiveWorkoutDraft = {
        ...draft,
        rest_timer: updatedTimer,
        updated_at: new Date().toISOString(),
      };
      set({ draft: updatedDraft, restTimer: updatedTimer });
      saveDraftToStorage(updatedDraft, draft.user_id);
    } else {
      set({ restTimer: updatedTimer });
    }
  },

  addRestTime: (seconds: number) => {
    const { draft, restTimer } = get();
    if (!restTimer) return;

    const updatedTimer: RestTimerState = {
      ...restTimer,
      remaining_seconds: restTimer.remaining_seconds + seconds,
      total_seconds: restTimer.total_seconds + seconds,
    };

    if (draft) {
      const updatedDraft: LiveWorkoutDraft = {
        ...draft,
        rest_timer: updatedTimer,
        updated_at: new Date().toISOString(),
      };
      set({ draft: updatedDraft, restTimer: updatedTimer });
      saveDraftToStorage(updatedDraft, draft.user_id);
    } else {
      set({ restTimer: updatedTimer });
    }
  },

  skipRest: () => {
    const { draft } = get();
    if (draft) {
      const updatedDraft: LiveWorkoutDraft = {
        ...draft,
        rest_timer: null,
        updated_at: new Date().toISOString(),
      };
      set({ draft: updatedDraft, restTimer: null });
      saveDraftToStorage(updatedDraft, draft.user_id);
    } else {
      set({ restTimer: null });
    }
  },

  tickRest: () => {
    const { draft, restTimer } = get();
    if (!restTimer || !restTimer.is_active || restTimer.is_paused) return;

    if (restTimer.remaining_seconds > 1) {
      const updatedTimer: RestTimerState = {
        ...restTimer,
        remaining_seconds: restTimer.remaining_seconds - 1,
      };
      set({
        restTimer: updatedTimer,
        draft: draft ? { ...draft, rest_timer: updatedTimer } : null,
      });
    } else {
      // Countdown finished
      triggerRestFinishedHaptic();
      playRestCompleteSound();

      if (draft) {
        const updatedDraft: LiveWorkoutDraft = {
          ...draft,
          rest_timer: null,
          updated_at: new Date().toISOString(),
        };
        set({ draft: updatedDraft, restTimer: null });
        saveDraftToStorage(updatedDraft, draft.user_id);
      } else {
        set({ restTimer: null });
      }
    }
  },

  tickElapsed: () => {
    const { draft, isActive, isPaused } = get();
    if (!draft || !isActive || isPaused) return;

    set({
      draft: {
        ...draft,
        elapsed_seconds: draft.elapsed_seconds + 1,
      },
    });
  },
}));
