import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import type { NetworkState } from "../types";

/**
 * Checks if the given network state should be considered offline.
 * Device is offline when either connection is dropped or internet is unreachable.
 */
export function isOfflineState(state: NetworkState): boolean {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

/**
 * Formats raw NetInfo state into typed IronTracker NetworkState.
 */
function mapNetInfoState(netInfoState: NetInfoState): NetworkState {
  const isConnected = netInfoState.isConnected ?? false;
  // If isConnected is false, isInternetReachable is definitely false.
  // Otherwise, use netInfoState.isInternetReachable, or fallback to isConnected if not determined yet.
  const isInternetReachable = !isConnected
    ? false
    : netInfoState.isInternetReachable ?? true;

  return {
    isConnected,
    isInternetReachable,
  };
}

/**
 * Queries current device network status.
 */
export async function checkConnection(): Promise<NetworkState> {
  try {
    const rawState = await NetInfo.fetch();
    return mapNetInfoState(rawState);
  } catch {
    return {
      isConnected: false,
      isInternetReachable: false,
    };
  }
}

/**
 * Subscribes to real-time network connectivity updates.
 * Returns unsubscribe teardown callback.
 */
export function subscribeNetworkState(
  listener: (state: NetworkState) => void
): () => void {
  try {
    return NetInfo.addEventListener((rawState) => {
      listener(mapNetInfoState(rawState));
    });
  } catch {
    return () => {};
  }
}
