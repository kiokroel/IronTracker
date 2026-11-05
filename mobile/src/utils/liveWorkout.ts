import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  BestSetSummary,
  LiveWorkoutDraft,
  LiveWorkoutExercise,
  LiveWorkoutSummary,
  WorkoutSessionCreate,
  WorkoutSessionExerciseItem,
} from "../types";

let idCounter = 0;

/**
 * Generates a unique client-side ID for exercises, sets, or workout drafts.
 */
export function generateId(prefix = "item"): string {
  idCounter += 1;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${time}_${idCounter}_${rand}`;
}

/**
 * Calculates estimated 1RM using the scientific Epley formula:
 * 1RM = weight * (1 + reps / 30)
 */
export function calculateSetOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/**
 * Calculates tonnage for an exercise.
 * If onlyCompleted is true, only completed working sets (non-warmup) are counted.
 */
export function calculateExerciseTonnage(
  exercise: LiveWorkoutExercise,
  onlyCompleted = true
): number {
  const setsToUse = onlyCompleted
    ? exercise.sets.filter((s) => s.is_completed)
    : exercise.sets;

  const total = setsToUse
    .filter((s) => !s.is_warmup && s.weight > 0 && s.reps > 0)
    .reduce((sum, s) => sum + s.weight * s.reps, 0);

  return Math.round(total * 100) / 100;
}

/**
 * Calculates total session tonnage across all exercises.
 */
export function calculateTonnage(
  exercises: LiveWorkoutExercise[],
  onlyCompleted = true
): number {
  const total = exercises.reduce(
    (acc, ex) => acc + calculateExerciseTonnage(ex, onlyCompleted),
    0
  );
  return Math.round(total * 100) / 100;
}

/**
 * Finds the set with the highest estimated 1RM for an exercise.
 */
export function calculateBestSetOneRepMax(
  exercise: LiveWorkoutExercise
): BestSetSummary | null {
  if (!exercise.sets || exercise.sets.length === 0) return null;

  let bestSet: { weight: number; reps: number; oneRepMax: number } | null = null;

  for (const s of exercise.sets) {
    if (s.weight > 0 && s.reps > 0) {
      const epley = calculateSetOneRepMax(s.weight, s.reps);
      if (!bestSet || epley > bestSet.oneRepMax) {
        bestSet = {
          weight: s.weight,
          reps: s.reps,
          oneRepMax: epley,
        };
      }
    }
  }

  if (!bestSet) return null;

  return {
    exercise_name: exercise.exercise_name,
    weight: bestSet.weight,
    reps: bestSet.reps,
    estimated_one_rep_max: bestSet.oneRepMax,
  };
}

/**
 * Formats seconds into MM:SS or HH:MM:SS.
 */
export function formatTimer(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Computes storage key for a user's live workout draft.
 */
export function getLiveWorkoutDraftKey(userId?: string | null): string {
  return `irontracker_live_workout_draft_${userId || "guest"}`;
}

/**
 * Saves draft to AsyncStorage with error handling.
 */
export async function saveDraftToStorage(
  draft: LiveWorkoutDraft,
  userId?: string | null
): Promise<void> {
  try {
    const key = getLiveWorkoutDraftKey(userId || draft.user_id);
    await AsyncStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.warn("Failed to persist live workout draft to storage", error);
  }
}

/**
 * Loads draft from AsyncStorage with error handling.
 */
export async function loadDraftFromStorage(
  userId?: string | null
): Promise<LiveWorkoutDraft | null> {
  try {
    const key = getLiveWorkoutDraftKey(userId);
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as LiveWorkoutDraft;
  } catch (error) {
    console.warn("Failed to load live workout draft from storage", error);
    return null;
  }
}

/**
 * Removes draft from AsyncStorage with error handling.
 */
export async function clearDraftFromStorage(
  userId?: string | null
): Promise<void> {
  try {
    const key = getLiveWorkoutDraftKey(userId);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to remove live workout draft from storage", error);
  }
}

/**
 * Computes end-of-workout statistics summary.
 */
export function computeLiveWorkoutSummary(
  draft: LiveWorkoutDraft
): LiveWorkoutSummary {
  const allSets = draft.exercises.flatMap((ex) => ex.sets);
  const completedSets = allSets.filter((s) => s.is_completed);

  // If some sets were marked complete, calculate tonnage on completed working sets.
  // Otherwise calculate on all working sets so athlete sees progress.
  const hasCompletedWorkingSets = completedSets.some(
    (s) => !s.is_warmup && s.weight > 0 && s.reps > 0
  );
  const totalTonnage = calculateTonnage(
    draft.exercises,
    hasCompletedWorkingSets
  );

  const best_sets: BestSetSummary[] = [];
  for (const ex of draft.exercises) {
    const best = calculateBestSetOneRepMax(ex);
    if (best) {
      best_sets.push(best);
    }
  }

  const durationSeconds = Math.max(0, draft.elapsed_seconds);
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

  return {
    duration_seconds: durationSeconds,
    duration_minutes: durationMinutes,
    total_tonnage: totalTonnage,
    total_sets: allSets.length,
    completed_sets: completedSets.length,
    exercises_count: draft.exercises.length,
    best_sets,
  };
}

/**
 * Converts active draft into payload for POST /api/v1/workout-sessions.
 * Preserves all exercises, sets, weights, reps, RPE, warmup status, exercise_id,
 * user-defined title, and notes without data truncation.
 */
export function draftToWorkoutSessionCreate(
  draft: LiveWorkoutDraft,
  notesOverride?: string | null
): WorkoutSessionCreate {
  const durationMinutes = Math.max(1, Math.round(draft.elapsed_seconds / 60));

  const hasAnyCompletedSets = draft.exercises.some((ex) =>
    ex.sets.some((s) => s.is_completed)
  );

  const exercises: WorkoutSessionExerciseItem[] = draft.exercises
    .map((ex) => {
      // Include completed sets if any were marked; otherwise include all sets with weight or reps
      const candidateSets = hasAnyCompletedSets
        ? ex.sets.filter((s) => s.is_completed || s.weight > 0 || s.reps > 0)
        : ex.sets;

      return {
        exercise_id: ex.exercise_id || null,
        exercise_name: ex.exercise_name,
        exercise_type: ex.exercise_type,
        sets: candidateSets.map((s, idx) => ({
          set_number: idx + 1,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          rpe:
            s.rpe !== undefined && s.rpe !== null && !isNaN(Number(s.rpe))
              ? Number(s.rpe)
              : null,
          is_warmup: Boolean(s.is_warmup),
        })),
        notes: ex.notes || null,
      };
    })
    .filter((ex) => ex.sets.length > 0);

  const finalNotes =
    notesOverride !== undefined && notesOverride !== null && notesOverride.trim() !== ""
      ? notesOverride.trim()
      : draft.notes || null;

  return {
    title: draft.title || "Live Workout",
    date: draft.started_at || new Date().toISOString(),
    duration_minutes: durationMinutes,
    exercises,
    notes: finalNotes,
  };
}
