import { create } from 'zustand';
import axios from 'axios';
import {
  LiveWorkoutDraft,
  LiveWorkoutSet,
  LiveWorkoutSummary,
  RestPresetSeconds,
} from '@/types/liveWorkout';
import { SessionExerciseType, WorkoutSessionExerciseItem } from '@/types/workoutSession';
import {
  loadLiveWorkoutDraft,
  saveLiveWorkoutDraft,
  clearLiveWorkoutDraft,
  createInitialLiveDraft,
  createDefaultLiveExercise,
  generateLiveId,
  calculateLiveWorkoutStats,
  calculateRestElapsedSeconds,
} from '@/utils/liveWorkout';
import { workoutSessionsApi } from '@/api/workoutSessions';

export interface LiveWorkoutStoreState {
  draft: LiveWorkoutDraft | null;
  isLiveModalOpen: boolean;
  isFinishing: boolean;
  finishError: string | null;
  celebrationSummary: LiveWorkoutSummary | null;

  // Lifecycle
  checkDraft: (userId: string) => LiveWorkoutDraft | null;
  startNewWorkout: (userId: string, title?: string, defaultExerciseName?: string) => void;
  resumeWorkout: () => void;
  closeLiveModal: () => void;
  discardWorkout: (userId: string) => void;

  // Metadata
  updateTitle: (title: string) => void;
  updateNotes: (notes: string) => void;

  // Exercises
  addExercise: (exercise: { id?: string | null; name: string; type: SessionExerciseType }) => void;
  removeExercise: (index: number) => void;
  setActiveExerciseIndex: (index: number) => void;

  // Sets
  logSet: (params: {
    weight: number;
    reps: number;
    rpe?: number | null;
    is_warmup: boolean;
  }) => void;
  duplicateLastSet: () => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  updateSet: (
    exerciseIndex: number,
    setIndex: number,
    updates: Partial<LiveWorkoutSet>
  ) => void;

  // Rest Timer
  setRestPreset: (preset: RestPresetSeconds) => void;
  startRestTimer: () => void;
  resetRestTimer: () => void;
  pauseRestTimer: () => void;
  toggleRestTimer: () => void;

  // Completion
  finishSession: (userId: string) => Promise<boolean>;
  clearCelebration: () => void;
}

export const useLiveWorkoutStore = create<LiveWorkoutStoreState>((set, get) => ({
  draft: null,
  isLiveModalOpen: false,
  isFinishing: false,
  finishError: null,
  celebrationSummary: null,

  checkDraft: (userId: string) => {
    if (!userId) return null;
    const existing = loadLiveWorkoutDraft(userId);
    set({ draft: existing });
    return existing;
  },

  startNewWorkout: (userId: string, title = 'Live Workout', defaultExerciseName = 'Bench Press') => {
    const newDraft = createInitialLiveDraft(userId, title, defaultExerciseName);
    saveLiveWorkoutDraft(newDraft);
    set({
      draft: newDraft,
      isLiveModalOpen: true,
      finishError: null,
      celebrationSummary: null,
    });
  },

  resumeWorkout: () => {
    set({ isLiveModalOpen: true });
  },

  closeLiveModal: () => {
    set({ isLiveModalOpen: false });
  },

  discardWorkout: (userId: string) => {
    clearLiveWorkoutDraft(userId);
    set({
      draft: null,
      isLiveModalOpen: false,
      celebrationSummary: null,
      finishError: null,
    });
  },

  updateTitle: (title: string) => {
    const { draft } = get();
    if (!draft) return;
    const updated = { ...draft, title };
    saveLiveWorkoutDraft(updated);
    set({ draft: updated });
  },

  updateNotes: (notes: string) => {
    const { draft } = get();
    if (!draft) return;
    const updated = { ...draft, notes };
    saveLiveWorkoutDraft(updated);
    set({ draft: updated });
  },

  addExercise: ({ id = null, name, type }) => {
    const { draft } = get();
    if (!draft) return;

    const newExercise = createDefaultLiveExercise(name, type, id);
    const updatedExercises = [...draft.exercises, newExercise];
    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
      activeExerciseIndex: updatedExercises.length - 1,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  removeExercise: (index: number) => {
    const { draft } = get();
    if (!draft) return;

    let updatedExercises = draft.exercises.filter((_, i) => i !== index);
    if (updatedExercises.length === 0) {
      updatedExercises = [createDefaultLiveExercise('Bench Press', 'strength')];
    }

    const nextActiveIndex = Math.max(
      0,
      Math.min(draft.activeExerciseIndex >= index ? draft.activeExerciseIndex - 1 : draft.activeExerciseIndex, updatedExercises.length - 1)
    );

    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
      activeExerciseIndex: nextActiveIndex,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  setActiveExerciseIndex: (index: number) => {
    const { draft } = get();
    if (!draft) return;
    if (index < 0 || index >= draft.exercises.length) return;

    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      activeExerciseIndex: index,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  logSet: ({ weight, reps, rpe = null, is_warmup = false }) => {
    const { draft } = get();
    if (!draft) return;

    const activeIndex = draft.activeExerciseIndex;
    const activeEx = draft.exercises[activeIndex];
    if (!activeEx) return;

    const completedAt = new Date().toISOString();
    const newSet: LiveWorkoutSet = {
      id: generateLiveId('set'),
      set_number: activeEx.sets.length + 1,
      weight: Math.max(0, weight),
      reps: Math.max(1, reps),
      rpe: rpe != null ? rpe : null,
      is_warmup,
      completed_at: completedAt,
    };

    const updatedExercises = draft.exercises.map((ex, i) => {
      if (i !== activeIndex) return ex;
      return {
        ...ex,
        sets: [...ex.sets, newSet],
      };
    });

    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
      lastCompletedSetAt: completedAt,
      restTimerStartedAt: completedAt,
      isRestRunning: true,
      restPausedElapsedSeconds: 0,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  duplicateLastSet: () => {
    const { draft, logSet } = get();
    if (!draft) return;

    const activeEx = draft.exercises[draft.activeExerciseIndex];
    if (!activeEx || activeEx.sets.length === 0) return;

    const lastSet = activeEx.sets[activeEx.sets.length - 1];
    logSet({
      weight: lastSet.weight,
      reps: lastSet.reps,
      rpe: lastSet.rpe,
      is_warmup: lastSet.is_warmup,
    });
  },

  removeSet: (exerciseIndex: number, setIndex: number) => {
    const { draft } = get();
    if (!draft) return;

    const ex = draft.exercises[exerciseIndex];
    if (!ex) return;

    const filteredSets = ex.sets
      .filter((_, i) => i !== setIndex)
      .map((s, idx) => ({ ...s, set_number: idx + 1 }));

    const updatedExercises = draft.exercises.map((item, i) => {
      if (i !== exerciseIndex) return item;
      return { ...item, sets: filteredSets };
    });

    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  updateSet: (exerciseIndex: number, setIndex: number, updates: Partial<LiveWorkoutSet>) => {
    const { draft } = get();
    if (!draft) return;

    const ex = draft.exercises[exerciseIndex];
    if (!ex) return;

    const updatedSets = ex.sets.map((s, idx) => {
      if (idx !== setIndex) return s;
      return { ...s, ...updates };
    });

    const updatedExercises = draft.exercises.map((item, i) => {
      if (i !== exerciseIndex) return item;
      return { ...item, sets: updatedSets };
    });

    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      exercises: updatedExercises,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  setRestPreset: (preset: RestPresetSeconds) => {
    const { draft } = get();
    if (!draft) return;

    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      restTargetSeconds: preset,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  startRestTimer: () => {
    const { draft } = get();
    if (!draft) return;

    const now = new Date().toISOString();
    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      isRestRunning: true,
      restTimerStartedAt: now,
      restPausedElapsedSeconds: 0,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  resetRestTimer: () => {
    const { draft } = get();
    if (!draft) return;

    const now = new Date().toISOString();
    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      isRestRunning: true,
      restTimerStartedAt: now,
      restPausedElapsedSeconds: 0,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  pauseRestTimer: () => {
    const { draft } = get();
    if (!draft) return;

    const elapsed = calculateRestElapsedSeconds(draft);
    const updatedDraft: LiveWorkoutDraft = {
      ...draft,
      isRestRunning: false,
      restPausedElapsedSeconds: elapsed,
    };

    saveLiveWorkoutDraft(updatedDraft);
    set({ draft: updatedDraft });
  },

  toggleRestTimer: () => {
    const { draft, pauseRestTimer } = get();
    if (!draft) return;

    if (draft.isRestRunning) {
      pauseRestTimer();
    } else {
      const pausedSeconds = draft.restPausedElapsedSeconds || 0;
      const simulatedStartMs = Date.now() - pausedSeconds * 1000;
      const updatedDraft: LiveWorkoutDraft = {
        ...draft,
        isRestRunning: true,
        restTimerStartedAt: new Date(simulatedStartMs).toISOString(),
      };

      saveLiveWorkoutDraft(updatedDraft);
      set({ draft: updatedDraft });
    }
  },

  finishSession: async (userId: string) => {
    const { draft } = get();
    if (!draft) return false;

    set({ isFinishing: true, finishError: null });

    try {
      const summary = calculateLiveWorkoutStats(draft);

      const exercisesPayload: WorkoutSessionExerciseItem[] = draft.exercises.map((ex) => ({
        exercise_id: ex.exercise_id || null,
        exercise_name: ex.exercise_name,
        exercise_type: ex.exercise_type,
        sets: ex.sets.map((s, idx) => ({
          set_number: idx + 1,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          rpe: s.rpe != null && s.rpe !== undefined ? Number(s.rpe) : null,
          is_warmup: Boolean(s.is_warmup),
        })),
        distance_km: ex.distance_km ?? null,
        duration_minutes: ex.duration_minutes ?? null,
        heart_rate: ex.heart_rate ?? null,
        calories_burned: ex.calories_burned ?? null,
        notes: ex.notes ?? null,
      }));

      await workoutSessionsApi.createWorkoutSession({
        title: draft.title || 'Live Workout',
        date: draft.startedAt,
        duration_minutes: summary.durationMinutes,
        exercises: exercisesPayload,
        notes: draft.notes || null,
      });

      // Clear draft after successful creation
      clearLiveWorkoutDraft(userId);

      set({
        draft: null,
        isFinishing: false,
        celebrationSummary: summary,
      });

      return true;
    } catch (err: unknown) {
      let message = 'Failed to save workout session. Please try again.';
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        message = String(err.response.data.detail);
      } else if (err instanceof Error) {
        message = err.message;
      }
      set({
        isFinishing: false,
        finishError: message,
      });
      return false;
    }
  },

  clearCelebration: () => {
    set({
      celebrationSummary: null,
      isLiveModalOpen: false,
      finishError: null,
    });
  },
}));
