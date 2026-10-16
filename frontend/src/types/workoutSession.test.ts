import { describe, it, expect } from 'vitest';
import {
  calculateClientSessionTonnage,
  WorkoutSessionExerciseItem,
} from './workoutSession';

describe('calculateClientSessionTonnage', () => {
  it('calculates total tonnage excluding warmup sets for strength and bodyweight', () => {
    const exercises: WorkoutSessionExerciseItem[] = [
      {
        exercise_name: 'Bench Press',
        exercise_type: 'strength',
        sets: [
          { set_number: 1, weight: 60, reps: 10, is_warmup: true }, // 600 kg warmup excluded
          { set_number: 2, weight: 100, reps: 5, is_warmup: false }, // 500 kg
          { set_number: 3, weight: 100, reps: 5, is_warmup: false }, // 500 kg
        ],
      },
      {
        exercise_name: 'Weighted Dips',
        exercise_type: 'bodyweight',
        sets: [
          { set_number: 1, weight: 20, reps: 10, is_warmup: false }, // 200 kg
        ],
      },
      {
        exercise_name: 'Treadmill Run',
        exercise_type: 'cardio',
        sets: [],
        distance_km: 5,
        duration_minutes: 25,
      },
    ];

    const total = calculateClientSessionTonnage(exercises);
    expect(total).toBe(1200); // 500 + 500 + 200 = 1200
  });

  it('returns 0 for empty exercises or cardio-only sessions', () => {
    expect(calculateClientSessionTonnage([])).toBe(0);

    const cardioOnly: WorkoutSessionExerciseItem[] = [
      {
        exercise_name: 'Cycling',
        exercise_type: 'cardio',
        sets: [],
        distance_km: 15,
      },
    ];
    expect(calculateClientSessionTonnage(cardioOnly)).toBe(0);
  });

  it('ignores sets with non-positive weight or reps', () => {
    const exercises: WorkoutSessionExerciseItem[] = [
      {
        exercise_name: 'Squat',
        exercise_type: 'strength',
        sets: [
          { set_number: 1, weight: 0, reps: 10, is_warmup: false },
          { set_number: 2, weight: 120, reps: 0, is_warmup: false },
          { set_number: 3, weight: 140, reps: 3, is_warmup: false }, // 420 kg
        ],
      },
    ];
    expect(calculateClientSessionTonnage(exercises)).toBe(420);
  });
});
