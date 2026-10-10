import { create } from 'zustand';
import axios from 'axios';
import { leaderboardApi } from '@/api/leaderboard';
import { LeaderboardEntry, LeaderboardPeriod, UserRankResponse } from '@/types/leaderboard';

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (err.response?.status === 503) {
      return 'Leaderboard service (Redis) is currently unavailable. Please try again shortly.';
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

interface LeaderboardState {
  entries: LeaderboardEntry[];
  totalEntries: number;
  myRank: UserRankResponse | null;
  period: LeaderboardPeriod;
  limit: number;
  offset: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastSyncedAt: Date | null;

  // Computed helper
  gapToNextRank: number | null;

  // Actions
  fetchLeaderboard: () => Promise<void>;
  fetchMyRank: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setLimit: (limit: number) => void;
  setPeriod: (period: LeaderboardPeriod) => void;
  setOffset: (offset: number) => void;
  clearError: () => void;
}

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  entries: [],
  totalEntries: 0,
  myRank: null,
  period: 'all',
  limit: 25,
  offset: 0,
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastSyncedAt: null,
  gapToNextRank: null,

  fetchLeaderboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const { limit, offset } = get();
      const response = await leaderboardApi.getTonnage(limit, offset);
      
      // Calculate gap to next rank if user has a rank
      const currentRank = get().myRank?.rank;
      let gap: number | null = null;
      if (currentRank && currentRank > 1) {
        const nextAthlete = response.entries.find((e) => e.rank === currentRank - 1);
        if (nextAthlete && get().myRank) {
          gap = Math.max(0, Math.round((nextAthlete.score - get().myRank!.score) * 10) / 10);
        }
      }

      set({
        entries: response.entries,
        totalEntries: response.total_entries,
        isLoading: false,
        lastSyncedAt: new Date(),
        gapToNextRank: gap,
      });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to load leaderboard data.');
      set({ isLoading: false, error: msg });
    }
  },

  fetchMyRank: async () => {
    try {
      const rankData = await leaderboardApi.getMyRank();
      
      // Recompute gap with current entries
      let gap: number | null = null;
      if (rankData.rank && rankData.rank > 1) {
        const nextAthlete = get().entries.find((e) => e.rank === rankData.rank! - 1);
        if (nextAthlete) {
          gap = Math.max(0, Math.round((nextAthlete.score - rankData.score) * 10) / 10);
        }
      }

      set({
        myRank: rankData,
        gapToNextRank: gap,
      });
    } catch (err: unknown) {
      // Non-critical, user might not have logged in workouts yet
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        set({ myRank: null, gapToNextRank: null });
      } else {
        const msg = extractErrorMessage(err, 'Failed to fetch personal ranking position.');
        set({ error: msg });
      }
    }
  },

  refreshAll: async () => {
    set({ isRefreshing: true, error: null });
    try {
      const { limit, offset } = get();
      const [boardData, rankData] = await Promise.allSettled([
        leaderboardApi.getTonnage(limit, offset),
        leaderboardApi.getMyRank(),
      ]);

      let newEntries = get().entries;
      let newTotal = get().totalEntries;
      let newRank = get().myRank;

      if (boardData.status === 'fulfilled') {
        newEntries = boardData.value.entries;
        newTotal = boardData.value.total_entries;
      }

      if (rankData.status === 'fulfilled') {
        newRank = rankData.value;
      }

      // Calculate gap to next rank
      let gap: number | null = null;
      if (newRank && newRank.rank && newRank.rank > 1) {
        const nextAthlete = newEntries.find((e) => e.rank === newRank!.rank! - 1);
        if (nextAthlete) {
          gap = Math.max(0, Math.round((nextAthlete.score - newRank.score) * 10) / 10);
        }
      }

      set({
        entries: newEntries,
        totalEntries: newTotal,
        myRank: newRank,
        isRefreshing: false,
        lastSyncedAt: new Date(),
        gapToNextRank: gap,
      });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to refresh leaderboard data.');
      set({ isRefreshing: false, error: msg });
    }
  },

  setLimit: (limit: number) => {
    set({ limit, offset: 0 });
    get().fetchLeaderboard();
  },

  setPeriod: (period: LeaderboardPeriod) => {
    set({ period });
    // In current Redis ZSET architecture tonnage is aggregated continuously
    get().refreshAll();
  },

  setOffset: (offset: number) => {
    set({ offset });
    get().fetchLeaderboard();
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useLeaderboardStore;
