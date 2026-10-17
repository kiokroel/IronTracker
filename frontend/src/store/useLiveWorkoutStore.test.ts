import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLiveWorkoutStore } from './useLiveWorkoutStore';
import { workoutSessionsApi } from '@/api/workoutSessions';
import { loadLiveWorkoutDraft } from '@/utils/liveWorkout';

vi.mock('@/api/workoutSessions', () => ({
  workoutSessionsApi: {
    createWorkoutSession: vi.fn(),
  },
}));

describe('useLiveWorkoutStore', () => {
  const userId = 'athlete-42';

  beforeEach(() => {
    localStorage.clear();
    useLiveWorkoutStore.setState({
      draft: null,
      isLiveModalOpen: false,
      isFinishing: false,
      finishError: null,
      celebrationSummary: null,
    });
    vi.clearAllMocks();
  });

  it('starts a new workout and persists initial draft to localStorage', () => {
    const store = useLiveWorkoutStore.getState();
    store.startNewWorkout(userId, 'Heavy Day', 'Bench Press');

    const state = useLiveWorkoutStore.getState();
    expect(state.draft).not.toBeNull();
    expect(state.draft?.userId).toBe(userId);
    expect(state.draft?.title).toBe('Heavy Day');
    expect(state.draft?.exercises).toHaveLength(1);
    expect(state.draft?.exercises[0].exercise_name).toBe('Bench Press');
    expect(state.isLiveModalOpen).toBe(true);

    const saved = loadLiveWorkoutDraft(userId);
    expect(saved).not.toBeNull();
    expect(saved?.title).toBe('Heavy Day');
  });

  it('checks and restores existing draft from localStorage', () => {
    const store = useLiveWorkoutStore.getState();
    store.startNewWorkout(userId, 'Saved Session');

    // Simulate page reload by resetting in-memory store
    useLiveWorkoutStore.setState({ draft: null, isLiveModalOpen: false });

    const restored = useLiveWorkoutStore.getState().checkDraft(userId);
    expect(restored).not.toBeNull();
    expect(restored?.title).toBe('Saved Session');
    expect(useLiveWorkoutStore.getState().draft?.title).toBe('Saved Session');
  });

  it('logs sets, restarts rest timer, and auto-saves', () => {
    const store = useLiveWorkoutStore.getState();
    store.startNewWorkout(userId, 'Push Day');

    store.logSet({
      weight: 100,
      reps: 5,
      rpe: 8,
      is_warmup: false,
    });

    const draft = useLiveWorkoutStore.getState().draft;
    expect(draft?.exercises[0].sets).toHaveLength(1);
    expect(draft?.exercises[0].sets[0].weight).toBe(100);
    expect(draft?.exercises[0].sets[0].reps).toBe(5);
    expect(draft?.exercises[0].sets[0].rpe).toBe(8);
    expect(draft?.exercises[0].sets[0].is_warmup).toBe(false);
    expect(draft?.isRestRunning).toBe(true);
    expect(draft?.restTimerStartedAt).not.toBeNull();

    // Check localStorage auto-save
    const saved = loadLiveWorkoutDraft(userId);
    expect(saved?.exercises[0].sets).toHaveLength(1);
  });

  it('duplicates last set in one click', () => {
    const store = useLiveWorkoutStore.getState();
    store.startNewWorkout(userId, 'Chest Focus');

    store.logSet({ weight: 105, reps: 4, rpe: 8.5, is_warmup: false });
    expect(useLiveWorkoutStore.getState().draft?.exercises[0].sets).toHaveLength(1);

    // One-click duplicate
    useLiveWorkoutStore.getState().duplicateLastSet();

    const draft = useLiveWorkoutStore.getState().draft;
    expect(draft?.exercises[0].sets).toHaveLength(2);
    expect(draft?.exercises[0].sets[1].weight).toBe(105);
    expect(draft?.exercises[0].sets[1].reps).toBe(4);
    expect(draft?.exercises[0].sets[1].rpe).toBe(8.5);
    expect(draft?.exercises[0].sets[1].set_number).toBe(2);
  });

  it('adds and switches active exercises', () => {
    const store = useLiveWorkoutStore.getState();
    store.startNewWorkout(userId, 'Full Body');

    store.addExercise({ name: 'Squats', type: 'strength' });

    const draft = useLiveWorkoutStore.getState().draft;
    expect(draft?.exercises).toHaveLength(2);
    expect(draft?.activeExerciseIndex).toBe(1);
    expect(draft?.exercises[1].exercise_name).toBe('Squats');

    store.setActiveExerciseIndex(0);
    expect(useLiveWorkoutStore.getState().draft?.activeExerciseIndex).toBe(0);
  });

  it('discards workout and removes draft from localStorage', () => {
    const store = useLiveWorkoutStore.getState();
    store.startNewWorkout(userId, 'To Discard');
    expect(loadLiveWorkoutDraft(userId)).not.toBeNull();

    store.discardWorkout(userId);

    expect(useLiveWorkoutStore.getState().draft).toBeNull();
    expect(loadLiveWorkoutDraft(userId)).toBeNull();
    expect(useLiveWorkoutStore.getState().isLiveModalOpen).toBe(false);
  });

  it('finishes session, submits payload to API, and clears draft', async () => {
    const mockCreatedSession = {
      id: 'session-999',
      user_id: userId,
      total_tonnage: 1000,
      exercises: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.mocked(workoutSessionsApi.createWorkoutSession).mockResolvedValueOnce(mockCreatedSession as never);

    const store = useLiveWorkoutStore.getState();
    store.startNewWorkout(userId, 'Heavy Pull');

    store.logSet({ weight: 140, reps: 5, rpe: 9, is_warmup: false });

    const success = await store.finishSession(userId);

    expect(success).toBe(true);
    expect(workoutSessionsApi.createWorkoutSession).toHaveBeenCalledTimes(1);
    expect(loadLiveWorkoutDraft(userId)).toBeNull();

    const state = useLiveWorkoutStore.getState();
    expect(state.draft).toBeNull();
    expect(state.celebrationSummary).not.toBeNull();
    expect(state.celebrationSummary?.totalTonnage).toBe(700);
    expect(state.celebrationSummary?.totalWorkingSetsCount).toBe(1);
  });
});
