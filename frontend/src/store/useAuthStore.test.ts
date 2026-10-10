import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './useAuthStore';
import { User } from '@/types/auth';

describe('useAuthStore (Zustand state management)', () => {
  const dummyUser: User = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'athlete@irontracker.io',
    username: 'iron_athlete',
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
  };

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().clearAuth();
  });

  it('initializes with unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('sets token and updates isAuthenticated correctly', () => {
    useAuthStore.getState().setToken('jwt-sample-token');
    expect(useAuthStore.getState().token).toBe('jwt-sample-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().setToken(null);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('sets user and updates auth status when token is present', () => {
    useAuthStore.getState().setToken('jwt-sample-token');
    useAuthStore.getState().setUser(dummyUser);

    expect(useAuthStore.getState().user).toEqual(dummyUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('setAuth sets token, user and sets isAuthenticated to true', () => {
    useAuthStore.getState().setAuth('test-token-123', dummyUser);

    const state = useAuthStore.getState();
    expect(state.token).toBe('test-token-123');
    expect(state.user?.email).toBe('athlete@irontracker.io');
    expect(state.isAuthenticated).toBe(true);
    expect(state.error).toBeNull();
  });

  it('logout and clearAuth completely reset credentials', () => {
    useAuthStore.getState().setAuth('test-token-123', dummyUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
