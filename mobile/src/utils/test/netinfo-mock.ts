export type NetInfoStateType =
  | "unknown"
  | "none"
  | "cellular"
  | "wifi"
  | "bluetooth"
  | "ethernet"
  | "wimax"
  | "vpn"
  | "other";

export interface NetInfoState {
  type: NetInfoStateType;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  details: Record<string, unknown> | null;
}

let currentState: NetInfoState = {
  type: "wifi",
  isConnected: true,
  isInternetReachable: true,
  details: { isConnectionExpensive: false },
};

const listeners = new Set<(state: NetInfoState) => void>();

export const fetch = async (): Promise<NetInfoState> => {
  return { ...currentState };
};

export const addEventListener = (
  listener: (state: NetInfoState) => void
): (() => void) => {
  listeners.add(listener);
  listener({ ...currentState });
  return () => {
    listeners.delete(listener);
  };
};

export const useNetInfo = (): NetInfoState => {
  return { ...currentState };
};

export const __setNetworkState = (state: Partial<NetInfoState>): void => {
  currentState = {
    ...currentState,
    ...state,
  };
  listeners.forEach((listener) => listener({ ...currentState }));
};

export const __resetNetworkState = (): void => {
  currentState = {
    type: "wifi",
    isConnected: true,
    isInternetReachable: true,
    details: { isConnectionExpensive: false },
  };
  listeners.clear();
};

const NetInfo = {
  fetch,
  addEventListener,
  useNetInfo,
  __setNetworkState,
  __resetNetworkState,
};

export default NetInfo;
