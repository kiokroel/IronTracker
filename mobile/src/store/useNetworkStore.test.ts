import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNetworkStore } from "./useNetworkStore";
import * as syncQueueService from "../services/syncQueue";
import NetInfo, {
  __resetNetworkState,
  __setNetworkState,
} from "../utils/test/netinfo-mock";

describe("useNetworkStore", () => {
  beforeEach(() => {
    __resetNetworkState();
    useNetworkStore.setState({
      isConnected: true,
      isInternetReachable: true,
      isOffline: false,
      wasOffline: false,
      reconnectedBannerVisible: false,
      queueCount: 0,
      isSyncing: false,
      lastSyncResult: null,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with default online state", () => {
    const state = useNetworkStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.isOffline).toBe(false);
  });

  it("updates state on manual checkConnection", async () => {
    __setNetworkState({ isConnected: false, isInternetReachable: false });

    await useNetworkStore.getState().checkConnection();

    const state = useNetworkStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isOffline).toBe(true);
  });

  it("refreshes queue count via syncQueueService", async () => {
    vi.spyOn(syncQueueService, "getSyncQueueCount").mockResolvedValueOnce(3);

    const count = await useNetworkStore.getState().refreshQueueCount("user-1");

    expect(count).toBe(3);
    expect(useNetworkStore.getState().queueCount).toBe(3);
  });

  it("triggers syncNow and updates queue count upon completion", async () => {
    vi.spyOn(syncQueueService, "processSyncQueue").mockResolvedValueOnce({
      syncedCount: 2,
      failedCount: 0,
      remainingCount: 0,
    });

    const result = await useNetworkStore.getState().syncNow("user-1");

    expect(result.syncedCount).toBe(2);
    expect(useNetworkStore.getState().queueCount).toBe(0);
    expect(useNetworkStore.getState().isSyncing).toBe(false);
  });

  it("reacts to network changes through initialize listener and triggers auto-sync on reconnect", async () => {
    const syncSpy = vi
      .spyOn(useNetworkStore.getState(), "syncNow")
      .mockResolvedValueOnce({
        syncedCount: 1,
        failedCount: 0,
        remainingCount: 0,
      });

    const unsubscribe = useNetworkStore.getState().initialize("user-1");

    // Simulate going offline
    __setNetworkState({ isConnected: false, isInternetReachable: false });
    expect(useNetworkStore.getState().isOffline).toBe(true);
    expect(useNetworkStore.getState().wasOffline).toBe(true);

    // Simulate connection restored
    __setNetworkState({ isConnected: true, isInternetReachable: true });
    expect(useNetworkStore.getState().isOffline).toBe(false);
    expect(useNetworkStore.getState().reconnectedBannerVisible).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith("user-1");

    unsubscribe();
  });

  it("dismisses reconnected banner on dismissReconnectedBanner", () => {
    useNetworkStore.setState({ reconnectedBannerVisible: true });
    expect(useNetworkStore.getState().reconnectedBannerVisible).toBe(true);

    useNetworkStore.getState().dismissReconnectedBanner();
    expect(useNetworkStore.getState().reconnectedBannerVisible).toBe(false);
  });
});
