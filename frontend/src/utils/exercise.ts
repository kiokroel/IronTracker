import type { TranslationKey } from '@/locales';

/**
 * Returns the matching TranslationKey for any exercise name or type.
 */
export function getExerciseTranslationKey(rawName?: string): TranslationKey {
  if (!rawName) return 'workouts.workout';
  const raw = rawName.toLowerCase();
  if (raw.includes('bench')) return 'workouts.bench_press';
  if (raw.includes('squat')) return 'workouts.squat';
  if (raw.includes('deadlift')) return 'workouts.deadlift';
  if (raw.includes('overhead')) return 'workouts.overhead_press';
  if (raw.includes('pull_up') || raw.includes('pullup')) return 'workouts.pull_up';
  if (raw.includes('barbell_row')) return 'workouts.barbell_row';
  if (raw.includes('treadmill')) return 'workouts.treadmill';
  if (raw.includes('rowing')) return 'workouts.rowing';
  if (raw.includes('cycling') || raw.includes('bike')) return 'workouts.cycling';
  if (raw.includes('cardio') || raw.includes('run')) return 'workouts.cardio';
  return 'workouts.workout';
}

/**
 * Translates an exercise type or raw string into localized user-friendly display name.
 */
export function formatExerciseName(
  rawName: string | undefined,
  t: (key: TranslationKey) => string
): string {
  if (!rawName) return t('workouts.workout');
  const key = getExerciseTranslationKey(rawName);
  if (key !== 'workouts.workout') {
    return t(key);
  }
  return rawName.replace(/_/g, ' ');
}
