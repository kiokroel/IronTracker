import { describe, it, expect } from 'vitest';
import { getExerciseTranslationKey, formatExerciseName } from './exercise';
import { useLocaleStore } from '@/store/useLocaleStore';

describe('Exercise localization utility', () => {
  it('maps standard exercise strings to correct translation keys', () => {
    expect(getExerciseTranslationKey('bench_press')).toBe('workouts.bench_press');
    expect(getExerciseTranslationKey('bench')).toBe('workouts.bench_press');
    expect(getExerciseTranslationKey('squats')).toBe('workouts.squat');
    expect(getExerciseTranslationKey('squat')).toBe('workouts.squat');
    expect(getExerciseTranslationKey('deadlift')).toBe('workouts.deadlift');
    expect(getExerciseTranslationKey('overhead_press')).toBe('workouts.overhead_press');
    expect(getExerciseTranslationKey('treadmill')).toBe('workouts.treadmill');
    expect(getExerciseTranslationKey('cardio')).toBe('workouts.cardio');
    expect(getExerciseTranslationKey('rowing')).toBe('workouts.rowing');
    expect(getExerciseTranslationKey('cycling')).toBe('workouts.cycling');
    expect(getExerciseTranslationKey('pull_up')).toBe('workouts.pull_up');
    expect(getExerciseTranslationKey('unknown_movement')).toBe('workouts.workout');
  });

  it('translates exercises accurately in Russian and English', () => {
    const { t, setLocale } = useLocaleStore.getState();

    setLocale('ru');
    expect(formatExerciseName('bench_press', t)).toBe('Жим лежа');
    expect(formatExerciseName('squats', t)).toBe('Приседания со штангой');
    expect(formatExerciseName('deadlift', t)).toBe('Становая тяга');
    expect(formatExerciseName('overhead_press', t)).toBe('Армейский жим');

    setLocale('en');
    expect(formatExerciseName('bench_press', t)).toBe('Bench Press');
    expect(formatExerciseName('squats', t)).toBe('Barbell Squat');
    expect(formatExerciseName('deadlift', t)).toBe('Deadlift');
    expect(formatExerciseName('overhead_press', t)).toBe('Overhead Press');
  });
});
