import { create } from "zustand";
import { checkConnection, isOfflineState, subscribeNetworkState } from "../services/network";
import {
  getSyncQueueCount,
  processSyncQueue,
} from "../services/syncQueue";
import { useAuthStore } from "./useAuthStore";
import type { NetworkState, SyncProcessResult } from "../types";

export interface NetworkStoreState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  isOffline: boolean;
  wasOffline: boolean;
  reconnectedBannerVisible: boolean;
  queueCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncProcessResult | null;

  initialize: (userId?: string | null) => () => void;
  checkConnection: () => Promise<NetworkState>;
  syncNow: (userId?: string | null) => Promise<SyncProcessResult>;
  refreshQueueCount: (userId?: string | null) => Promise<number>;
  setNetworkState: (state: Partial<NetworkState>) => void;
  dismissReconnectedBanner: () => void;
}

let bannerDismissTimer: ReturnType<typeof setTimeout> | null = null;

export const useNetworkStore = create<NetworkStoreState>((set, get) => ({
  isConnected: true,
  isInternetReachable: true,
  isOffline: false,
  wasOffline: false,
  reconnectedBannerVisible: false,
  queueCount: 0,
  isSyncing: false,
  lastSyncResult: null,

  initialize: (userId?: string | null) => {
    const resolveUserId = () => userId ?? useAuthStore.getState().user?.id;

    // Refresh queue count initially
    get().refreshQueueCount(resolveUserId());

    // Check initial connection
    get().checkConnection();

    // Subscribe to network changes
    const unsubscribe = subscribeNetworkState(async (netState) => {
      const prevOffline = get().isOffline;
      const nextOffline = isOfflineState(netState);

      set({
        isConnected: netState.isConnected,
        isInternetReachable: netState.isInternetReachable,
        isOffline: nextOffline,
      });

      // Detected reconnection: network was offline and is now back online
      if (prevOffline && !nextOffline) {
        if (bannerDismissTimer) clearTimeout(bannerDismissTimer);

        set({
          wasOffline: true,
          reconnectedBannerVisible: true,
        });

        // Trigger automatic offline queue processing upon reconnection
        await get().syncNow(resolveUserId());

        // Auto-dismiss the reconnection banner after 4 seconds
        bannerDismissTimer = setTimeout(() => {
          set({ reconnectedBannerVisible: false });
        }, 4000);
      } else if (nextOffline) {
        set({ wasOffline: true, reconnectedBannerVisible: false });
      }
    });

    return unsubscribe;
  },

  checkConnection: async () => {
    const netState = await checkConnection();
    const isOffline = isOfflineState(netState);

    set({
      isConnected: netState.isConnected,
      isInternetReachable: netState.isInternetReachable,
      isOffline,
    });

    return netState;
  },

  syncNow: async (userId?: string | null) => {
    const targetUserId = userId ?? useAuthStore.getState().user?.id;
    set({ isSyncing: true });

    try {
      const result = await processSyncQueue(targetUserId);
      set({
        queueCount: result.remainingCount,
        lastSyncResult: result,
      });
      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  refreshQueueCount: async (userId?: string | null) => {
    const targetUserId = userId ?? useAuthStore.getState().user?.id;
    const count = await getSyncQueueCount(targetUserId);
    set({ queueCount: count });
    return count;
  },

  setNetworkState: (state: Partial<NetworkState>) => {
    set((prev) => {
      const isConnected = state.isConnected !== undefined ? state.isConnected : prev.isConnected;
      const isInternetReachable =
        state.isInternetReachable !== undefined
          ? state.isInternetReachable
          : prev.isInternetReachable;

      const isOffline = isOfflineState({ isConnected, isInternetReachable });

      return {
        isConnected,
        isInternetReachable,
        isOffline,
      };
    });
  },

  dismissReconnectedBanner: () => {
    if (bannerDismissTimer) clearTimeout(bannerDismissTimer);
    set({ reconnectedBannerVisible: false });
  },
}));
