import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";

// Default endpoints: Android emulator uses 10.0.2.2 to reach host machine, Web/iOS uses localhost
const DEFAULT_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:80/api/v1"
    : "http://localhost:80/api/v1");

let currentBaseUrl: string = DEFAULT_URL;
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
    if (currentAuthToken && config.headers) {
      config.headers.Authorization = `Bearer ${currentAuthToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export function setApiBaseUrl(newUrl: string): void {
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
