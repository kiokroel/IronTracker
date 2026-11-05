import { create } from "zustand";
import { getCurrentUser, loginUser, registerUser } from "../api/auth";
import { setAuthToken, setOnUnauthorizedCallback } from "../api/client";
import {
  clearAuthSession,
  getAuthToken,
  getUserData,
  saveAuthToken,
  saveUserData,
} from "../services/storage";
import type { LoginRequest, RegisterRequest, User } from "../types";

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  checkAuth: () => Promise<void>;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await getAuthToken();
      if (!token) {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      setAuthToken(token);
      let user = await getUserData();

      // Attempt to refresh profile from API, fallback to stored user
      try {
        const freshUser = await getCurrentUser();
        user = freshUser;
        await saveUserData(freshUser);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr?.response?.status === 401) {
          await clearAuthSession();
          setAuthToken(null);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: "Сессия истекла. Пожалуйста, выполните вход.",
          });
          return;
        }
        // If offline or network error, keep cached user
      }

      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      await clearAuthSession();
      setAuthToken(null);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true, error: null });
    try {
      const data = await loginUser(credentials);
      const token = data.access_token;
      setAuthToken(token);
      await saveAuthToken(token);

      // Fetch full profile
      let user: User | null = null;
      try {
        user = await getCurrentUser();
      } catch {
        user = {
          id: data.user_id,
          email: data.email,
          username: data.email.split("@")[0] || "Athlete",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      await saveUserData(user);

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail || "Ошибка входа в аккаунт"
          : "Не удалось подключиться к серверу";

      set({
        isLoading: false,
        error: message,
      });
      throw new Error(message);
    }
  },

  register: async (payload: RegisterRequest) => {
    set({ isLoading: true, error: null });
    try {
      await registerUser(payload);
      // Auto-login after registration
      const data = await loginUser({
        email: payload.email,
        password: payload.password,
      });

      const token = data.access_token;
      setAuthToken(token);
      await saveAuthToken(token);

      const user = await getCurrentUser();
      await saveUserData(user);

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail || "Ошибка регистрации"
          : "Не удалось зарегистрировать аккаунт";

      set({
        isLoading: false,
        error: message,
      });
      throw new Error(message);
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await clearAuthSession();
      setAuthToken(null);
    } finally {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

setOnUnauthorizedCallback(async () => {
  await clearAuthSession();
  setAuthToken(null);
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: "Сессия истекла. Пожалуйста, выполните вход повторно.",
  });
});
