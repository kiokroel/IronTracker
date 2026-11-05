import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkConnection,
  isOfflineState,
  subscribeNetworkState,
} from "./network";
import NetInfo, {
  __resetNetworkState,
  __setNetworkState,
} from "../utils/test/netinfo-mock";
import type { NetworkState } from "../types";

describe("network service", () => {
  beforeEach(() => {
    __resetNetworkState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isOfflineState", () => {
    it("returns false when both isConnected and isInternetReachable are true", () => {
      const state: NetworkState = {
        isConnected: true,
        isInternetReachable: true,
      };
      expect(isOfflineState(state)).toBe(false);
    });

    it("returns true when isConnected is false", () => {
      const state: NetworkState = {
        isConnected: false,
        isInternetReachable: true,
      };
      expect(isOfflineState(state)).toBe(true);
    });

    it("returns true when isInternetReachable is false even if isConnected is true", () => {
      const state: NetworkState = {
        isConnected: true,
        isInternetReachable: false,
      };
      expect(isOfflineState(state)).toBe(true);
    });
  });

  describe("checkConnection", () => {
    it("returns online state when NetInfo reports connected", async () => {
      __setNetworkState({ isConnected: true, isInternetReachable: true });
      const result = await checkConnection();

      expect(result).toEqual({
        isConnected: true,
        isInternetReachable: true,
      });
    });

    it("returns offline state when NetInfo reports disconnected", async () => {
      __setNetworkState({ isConnected: false, isInternetReachable: false });
      const result = await checkConnection();

      expect(result).toEqual({
        isConnected: false,
        isInternetReachable: false,
      });
    });

    it("safely handles exceptions from NetInfo.fetch", async () => {
      vi.spyOn(NetInfo, "fetch").mockRejectedValueOnce(new Error("NetInfo crash"));
      const result = await checkConnection();

      expect(result).toEqual({
        isConnected: false,
        isInternetReachable: false,
      });
    });
  });

  describe("subscribeNetworkState", () => {
    it("notifies subscriber on registration and state changes", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeNetworkState(listener);

      // Initial invocation
      expect(listener).toHaveBeenCalledWith({
        isConnected: true,
        isInternetReachable: true,
      });

      // Update state
      __setNetworkState({ isConnected: false, isInternetReachable: false });
      expect(listener).toHaveBeenCalledWith({
        isConnected: false,
        isInternetReachable: false,
      });

      // Teardown
      unsubscribe();
      listener.mockClear();

      __setNetworkState({ isConnected: true, isInternetReachable: true });
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
