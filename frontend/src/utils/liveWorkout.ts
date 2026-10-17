import {
  LiveWorkoutDraft,
  LiveWorkoutExercise,
  LiveWorkoutSummary,
} from '@/types/liveWorkout';
import { SessionExerciseType } from '@/types/workoutSession';

/**
 * Storage key generator for live workout drafts isolated per user.
 */
export function getLiveWorkoutDraftKey(userId: string): string {
  const safeId = (userId || 'anonymous').trim();
  return `irontracker_live_workout_draft_${safeId}`;
}

/**
 * Safely load live workout draft from browser LocalStorage.
 */
export function loadLiveWorkoutDraft(userId: string): LiveWorkoutDraft | null {
  if (typeof localStorage === 'undefined' || !userId) {
    return null;
  }
  try {
    const key = getLiveWorkoutDraftKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LiveWorkoutDraft>;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      parsed.userId === userId &&
      Array.isArray(parsed.exercises) &&
      typeof parsed.startedAt === 'string'
    ) {
      return parsed as LiveWorkoutDraft;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist live workout draft to LocalStorage.
 */
export function saveLiveWorkoutDraft(draft: LiveWorkoutDraft): void {
  if (typeof localStorage === 'undefined' || !draft || !draft.userId) {
    return;
  }
  try {
    const key = getLiveWorkoutDraftKey(draft.userId);
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Graceful fallback for quota / private browsing errors
  }
}

/**
 * Discard and remove live workout draft from LocalStorage.
 */
export function clearLiveWorkoutDraft(userId: string): void {
  if (typeof localStorage === 'undefined' || !userId) {
    return;
  }
  try {
    const key = getLiveWorkoutDraftKey(userId);
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

/**
 * Unique ID generator for live workout entities.
 */
export function generateLiveId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a default empty live exercise.
 */
export function createDefaultLiveExercise(
  name: string = 'Bench Press',
  type: SessionExerciseType = 'strength',
  exerciseId: string | null = null
): LiveWorkoutExercise {
  return {
    id: generateLiveId('ex'),
    exercise_id: exerciseId,
    exercise_name: name,
    exercise_type: type,
    sets: [],
    distance_km: null,
    duration_minutes: null,
    heart_rate: null,
    calories_burned: null,
    notes: null,
  };
}

/**
 * Create initial draft for a brand new live workout session.
 */
export function createInitialLiveDraft(
  userId: string,
  initialTitle: string = 'Live Workout',
  defaultExerciseName: string = 'Bench Press'
): LiveWorkoutDraft {
  const now = new Date().toISOString();
  return {
    userId,
    title: initialTitle,
    startedAt: now,
    exercises: [createDefaultLiveExercise(defaultExerciseName, 'strength')],
    activeExerciseIndex: 0,
    lastCompletedSetAt: null,
    restTargetSeconds: 90, // default rest preset: 90 seconds
    restTimerStartedAt: null,
    isRestRunning: false,
    restPausedElapsedSeconds: 0,
  };
}

/**
 * Format total seconds into mm:ss or hh:mm:ss string.
 */
export function formatTimerDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);

  const pad = (n: number) => String(n).padStart(2, '0');

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Format rest interval in concise localized form (e.g. "1м 45с" or "1m 45s").
 */
export function formatRestTimerDisplay(seconds: number, locale: string = 'ru'): string {
  const safeSeconds = Math.max(0, Math.floor(isNaN(seconds) ? 0 : seconds));
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;

  const isRu = locale.toLowerCase().startsWith('ru');
  const minUnit = isRu ? 'м' : 'm';
  const secUnit = isRu ? 'с' : 's';

  if (m === 0) {
    return `${s}${secUnit}`;
  }
  return `${m}${minUnit} ${s}${secUnit}`;
}

/**
 * Calculate rest elapsed seconds taking wall-clock timestamps into account.
 */
export function calculateRestElapsedSeconds(
  draft: Pick<
    LiveWorkoutDraft,
    'isRestRunning' | 'restTimerStartedAt' | 'restPausedElapsedSeconds'
  >,
  nowMs: number = Date.now()
): number {
  if (!draft.isRestRunning) {
    return draft.restPausedElapsedSeconds || 0;
  }
  if (!draft.restTimerStartedAt) {
    return 0;
  }
  const startedMs = new Date(draft.restTimerStartedAt).getTime();
  if (isNaN(startedMs)) {
    return 0;
  }
  const elapsed = Math.floor((nowMs - startedMs) / 1000);
  return Math.max(0, elapsed);
}

/**
 * Calculate final summary statistics for a completed live workout session.
 */
export function calculateLiveWorkoutStats(
  draft: LiveWorkoutDraft,
  finishedAt: string = new Date().toISOString()
): LiveWorkoutSummary {
  const startMs = new Date(draft.startedAt).getTime();
  const finishMs = new Date(finishedAt).getTime();
  const rawMinutes = Math.round((finishMs - startMs) / 60000);
  const durationMinutes = Math.max(1, isNaN(rawMinutes) ? 1 : rawMinutes);

  let totalTonnage = 0;
  let totalWorkingSetsCount = 0;
  let totalSetsCount = 0;
  let exercisesWithWorkCount = 0;

  for (const ex of draft.exercises) {
    let hasWork = false;

    if (ex.exercise_type === 'strength' || ex.exercise_type === 'bodyweight') {
      for (const st of ex.sets) {
        totalSetsCount += 1;
        if (!st.is_warmup) {
          totalWorkingSetsCount += 1;
          if (st.weight > 0 && st.reps > 0) {
            totalTonnage += st.weight * st.reps;
          }
        }
        hasWork = true;
      }
    } else if (ex.exercise_type === 'cardio') {
      if ((ex.distance_km && ex.distance_km > 0) || (ex.duration_minutes && ex.duration_minutes > 0)) {
        hasWork = true;
      }
    }

    if (hasWork) {
      exercisesWithWorkCount += 1;
    }
  }

  return {
    title: draft.title || 'Live Workout',
    durationMinutes,
    totalTonnage: Math.round(totalTonnage * 10) / 10,
    totalWorkingSetsCount,
    totalSetsCount,
    totalExercisesCount: Math.max(exercisesWithWorkCount, draft.exercises.length > 0 && totalSetsCount > 0 ? 1 : 0),
    completedAt: finishedAt,
  };
}
