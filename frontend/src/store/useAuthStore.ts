import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios from 'axios';
import { User, LoginRequest, RegisterRequest, TokenResponse } from '@/types/auth';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  logout: () => void;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: Boolean(user && get().token) });
      },

      setToken: (token: string | null) => {
        set({ token, isAuthenticated: Boolean(token) });
      },

      setAuth: (token: string, user: User) => {
        set({
          token,
          user,
          isAuthenticated: true,
          error: null,
        });
      },

      clearAuth: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      logout: () => {
        get().clearAuth();
      },

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });
        try {
          const tokenRes = await axios.post<TokenResponse>('/api/v1/users/login', credentials, {
            headers: { 'Content-Type': 'application/json' },
          });

          const { access_token } = tokenRes.data;

          const meRes = await axios.get<User>('/api/v1/users/me', {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${access_token}`,
            },
          });

          set({
            token: access_token,
            user: meRes.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err: unknown) {
          let message = 'Authentication failed. Please check your credentials.';
          if (axios.isAxiosError(err) && err.response?.data?.detail) {
            message = String(err.response.data.detail);
          } else if (err instanceof Error) {
            message = err.message;
          }
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          });
          throw new Error(message);
        }
      },

      register: async (payload: RegisterRequest) => {
        set({ isLoading: true, error: null });
        try {
          await axios.post<User>('/api/v1/users/register', payload, {
            headers: { 'Content-Type': 'application/json' },
          });

          // Automatically authenticate after successful registration
          await get().login({
            email: payload.email,
            password: payload.password,
          });
        } catch (err: unknown) {
          let message = 'Registration failed. Please check your data.';
          if (axios.isAxiosError(err) && err.response?.data?.detail) {
            message = String(err.response.data.detail);
          } else if (err instanceof Error) {
            message = err.message;
          }
          set({
            isLoading: false,
            error: message,
          });
          throw new Error(message);
        }
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          get().clearAuth();
          return;
        }

        try {
          const res = await axios.get<User>('/api/v1/users/me', {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          set({
            user: res.data,
            isAuthenticated: true,
          });
        } catch {
          get().clearAuth();
        }
      },
    }),
    {
      name: 'irontracker-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
