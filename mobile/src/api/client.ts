import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

export function resolveApiBaseUrl(): string {
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  const hostUri = Constants.expoConfig?.hostUri;

  // 1. Detect if active bundle is running via Expo Tunnel (.expo.app or .exp.direct)
  const isTunnel = Boolean(
    (scriptURL && (scriptURL.includes(".expo.app") || scriptURL.includes(".exp.direct"))) ||
    (hostUri && (hostUri.includes(".expo.app") || hostUri.includes(".exp.direct")))
  );

  if (isTunnel) {
    if (scriptURL) {
      try {
        const match = scriptURL.match(/^(https?:\/\/[^/]+)/);
        if (match) {
          let base = match[1].replace(/^http:\/\//i, "https://");
          base = base.replace(/:(80|443|8081)$/, "");
          return `${base}/api/v1`;
        }
      } catch {
        // ignore
      }
    }
    if (hostUri) {
      const cleanHost = hostUri.replace(/:(80|443|8081)$/, "");
      return `https://${cleanHost}/api/v1`;
    }
  }

  // 2. Explicit env configuration (has priority when configured and not on a tunnel)
  if (process.env.EXPO_PUBLIC_API_URL) {
    let url = process.env.EXPO_PUBLIC_API_URL;
    if (url.includes(".expo.app") || url.includes(".exp.direct")) {
      url = url.replace(/^http:\/\//i, "https://");
    }
    return url;
  }

  // 3. Auto-detect from active bundle URL
  if (scriptURL) {
    try {
      const match = scriptURL.match(/^(https?:\/\/[^/]+)/);
      if (match) {
        let base = match[1];
        if (base.includes(".expo.app") || base.includes(".exp.direct")) {
          base = base.replace(/^http:\/\//i, "https://");
        }
        return `${base}/api/v1`;
      }
    } catch {
      // ignore
    }
  }

  // 4. Expo Constants hostUri
  if (hostUri) {
    const proto = (hostUri.includes(".expo.app") || hostUri.includes(".exp.direct")) ? "https" : "http";
    return `${proto}://${hostUri}/api/v1`;
  }

  // 5. Default emulator / localhost fallback
  return Platform.OS === "android"
    ? "http://10.0.2.2:80/api/v1"
    : "http://localhost:80/api/v1";
}

let customBaseUrlSet = false;
let currentBaseUrl: string = resolveApiBaseUrl();
let currentAuthToken: string | null = null;

export const apiClient: AxiosInstance = axios.create({
  baseURL: currentBaseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const activeUrl = customBaseUrlSet ? currentBaseUrl : resolveApiBaseUrl();
    config.baseURL = activeUrl;
    if (__DEV__) {
      console.log(`[HTTP REQ] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    }

    if (currentAuthToken && config.headers) {
      config.headers.Authorization = `Bearer ${currentAuthToken}`;
    }
    return config;
  },
  (error) => {
    if (__DEV__) {
      console.error("[HTTP REQ ERR]", error);
    }
    return Promise.reject(error);
  }
);

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(cb: (() => void) | null): void {
  onUnauthorizedCallback = cb;
}

apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`[HTTP RES] ${response.status} from ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    if (__DEV__) {
      console.error(
        `[HTTP RES ERR] status=${error.response?.status} url=${error.config?.url}:`,
        error.response?.data || error.message
      );
    }
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      if (!url.includes("/users/login") && !url.includes("/users/register")) {
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
      }
    }
    return Promise.reject(error);
  }
);

export function setApiBaseUrl(newUrl: string): void {
  customBaseUrlSet = true;
  currentBaseUrl = newUrl;
  apiClient.defaults.baseURL = newUrl;
}

export function getApiBaseUrl(): string {
  return currentBaseUrl;
}

export function setAuthToken(token: string | null): void {
  currentAuthToken = token;
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

export default apiClient;
