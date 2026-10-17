import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLiveWorkoutDraftKey,
  loadLiveWorkoutDraft,
  saveLiveWorkoutDraft,
  clearLiveWorkoutDraft,
  createDefaultLiveExercise,
  createInitialLiveDraft,
  formatTimerDuration,
  formatRestTimerDisplay,
  calculateRestElapsedSeconds,
  calculateLiveWorkoutStats,
} from './liveWorkout';
import { LiveWorkoutDraft } from '@/types/liveWorkout';

describe('liveWorkout utils', () => {
  const userId = 'athlete-123';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('Storage helpers', () => {
    it('generates user-isolated draft keys', () => {
      expect(getLiveWorkoutDraftKey(userId)).toBe('irontracker_live_workout_draft_athlete-123');
      expect(getLiveWorkoutDraftKey('')).toBe('irontracker_live_workout_draft_anonymous');
    });

    it('saves and loads valid draft from localStorage', () => {
      const draft = createInitialLiveDraft(userId, 'Morning Push');
      saveLiveWorkoutDraft(draft);

      const loaded = loadLiveWorkoutDraft(userId);
      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe('Morning Push');
      expect(loaded?.userId).toBe(userId);
      expect(loaded?.exercises).toHaveLength(1);
    });

    it('returns null when draft does not exist or user mismatch', () => {
      expect(loadLiveWorkoutDraft('nonexistent')).toBeNull();

      const draft = createInitialLiveDraft('user-a', 'Session A');
      saveLiveWorkoutDraft(draft);

      expect(loadLiveWorkoutDraft('user-b')).toBeNull();
    });

    it('clears draft from localStorage', () => {
      const draft = createInitialLiveDraft(userId, 'Temp');
      saveLiveWorkoutDraft(draft);
      expect(loadLiveWorkoutDraft(userId)).not.toBeNull();

      clearLiveWorkoutDraft(userId);
      expect(loadLiveWorkoutDraft(userId)).toBeNull();
    });

    it('creates default exercise with custom name and type', () => {
      const ex = createDefaultLiveExercise('Deadlift', 'strength');
      expect(ex.exercise_name).toBe('Deadlift');
      expect(ex.exercise_type).toBe('strength');
      expect(ex.sets).toEqual([]);
    });
  });

  describe('Time formatters', () => {
    it('formats duration in mm:ss and hh:mm:ss', () => {
      expect(formatTimerDuration(0)).toBe('00:00');
      expect(formatTimerDuration(65)).toBe('01:05');
      expect(formatTimerDuration(3665)).toBe('1:01:05');
      expect(formatTimerDuration(-10)).toBe('00:00');
      expect(formatTimerDuration(NaN)).toBe('00:00');
    });

    it('formats rest timer display in localized units', () => {
      expect(formatRestTimerDisplay(45, 'ru')).toBe('45с');
      expect(formatRestTimerDisplay(105, 'ru')).toBe('1м 45с');
      expect(formatRestTimerDisplay(45, 'en')).toBe('45s');
      expect(formatRestTimerDisplay(120, 'en')).toBe('2m 0s');
      expect(formatRestTimerDisplay(0, 'ru')).toBe('0с');
    });
  });

  describe('calculateRestElapsedSeconds', () => {
    it('returns paused seconds when rest is not running', () => {
      const result = calculateRestElapsedSeconds({
        isRestRunning: false,
        restTimerStartedAt: null,
        restPausedElapsedSeconds: 42,
      });
      expect(result).toBe(42);
    });

    it('calculates elapsed seconds from wall clock timestamp when running', () => {
      const now = Date.now();
      const startedAt = new Date(now - 75000).toISOString(); // 75 seconds ago

      const result = calculateRestElapsedSeconds(
        {
          isRestRunning: true,
          restTimerStartedAt: startedAt,
        },
        now
      );
      expect(result).toBe(75);
    });
  });

  describe('calculateLiveWorkoutStats', () => {
    it('computes summary tonnage, working sets, and duration correctly', () => {
      const started = new Date(Date.now() - 45 * 60000).toISOString(); // 45 mins ago
      const finished = new Date().toISOString();

      const draft: LiveWorkoutDraft = {
        userId,
        title: 'Bench & Squat Blast',
        startedAt: started,
        activeExerciseIndex: 0,
        restTargetSeconds: 90,
        isRestRunning: false,
        exercises: [
          {
            id: 'ex1',
            exercise_name: 'Bench Press',
            exercise_type: 'strength',
            sets: [
              {
                id: 's1',
                set_number: 1,
                weight: 60,
                reps: 10,
                is_warmup: true,
                completed_at: started,
              },
              {
                id: 's2',
                set_number: 2,
                weight: 100,
                reps: 5,
                rpe: 8,
                is_warmup: false,
                completed_at: started,
              },
              {
                id: 's3',
                set_number: 3,
                weight: 100,
                reps: 5,
                rpe: 8.5,
                is_warmup: false,
                completed_at: started,
              },
            ],
          },
          {
            id: 'ex2',
            exercise_name: 'Squat',
            exercise_type: 'strength',
            sets: [
              {
                id: 's4',
                set_number: 1,
                weight: 120,
                reps: 5,
                rpe: 9,
                is_warmup: false,
                completed_at: started,
              },
            ],
          },
        ],
      };

      const stats = calculateLiveWorkoutStats(draft, finished);

      expect(stats.title).toBe('Bench & Squat Blast');
      expect(stats.durationMinutes).toBe(45);
      // Working tonnage:
      // ex1: 100*5 + 100*5 = 1000 kg (warmup 60*10 excluded!)
      // ex2: 120*5 = 600 kg
      // Total = 1600 kg
      expect(stats.totalTonnage).toBe(1600);
      expect(stats.totalWorkingSetsCount).toBe(3);
      expect(stats.totalSetsCount).toBe(4);
      expect(stats.totalExercisesCount).toBe(2);
    });
  });
});
