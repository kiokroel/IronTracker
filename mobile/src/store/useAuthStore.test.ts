import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "../api/auth";
import * as storage from "../services/storage";
import type { TokenResponse, User } from "../types";
import { useAuthStore } from "./useAuthStore";

const mockToken: TokenResponse = {
  access_token: "jwt-test-token-777",
  token_type: "bearer",
  user_id: "user-uuid-1",
  email: "athlete@irontracker.io",
};

const mockUser: User = {
  id: "user-uuid-1",
  email: "athlete@irontracker.io",
  username: "IronChamp",
  created_at: "2026-10-10T12:00:00Z",
  updated_at: "2026-10-10T12:00:00Z",
};

describe("useAuthStore", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await storage.clearAuthSession();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it("should have correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("should login user successfully and update state and storage", async () => {
    vi.spyOn(authApi, "loginUser").mockResolvedValue(mockToken);
    vi.spyOn(authApi, "getCurrentUser").mockResolvedValue(mockUser);

    await useAuthStore.getState().login({
      email: "athlete@irontracker.io",
      password: "StrongPassword123!",
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(mockToken.access_token);
    expect(state.user).toEqual(mockUser);
    expect(state.error).toBeNull();

    expect(await storage.getAuthToken()).toBe(mockToken.access_token);
    expect(await storage.getUserData()).toEqual(mockUser);
  });

  it("should handle login errors gracefully", async () => {
    vi.spyOn(authApi, "loginUser").mockRejectedValue({
      response: { data: { detail: "Invalid email or password" } },
    });

    await expect(
      useAuthStore.getState().login({
        email: "athlete@irontracker.io",
        password: "WrongPassword",
      })
    ).rejects.toThrow("Invalid email or password");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe("Invalid email or password");
  });

  it("should register user and auto-login", async () => {
    vi.spyOn(authApi, "registerUser").mockResolvedValue(mockUser);
    vi.spyOn(authApi, "loginUser").mockResolvedValue(mockToken);
    vi.spyOn(authApi, "getCurrentUser").mockResolvedValue(mockUser);

    await useAuthStore.getState().register({
      email: "athlete@irontracker.io",
      username: "IronChamp",
      password: "StrongPassword123!",
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.username).toBe("IronChamp");
  });

  it("should logout user and clear storage", async () => {
    await storage.saveAuthToken("some-token");
    await storage.saveUserData(mockUser);
    useAuthStore.setState({
      user: mockUser,
      token: "some-token",
      isAuthenticated: true,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();

    expect(await storage.getAuthToken()).toBeNull();
    expect(await storage.getUserData()).toBeNull();
  });

  it("should restore session on checkAuth if valid token exists in storage", async () => {
    await storage.saveAuthToken("persisted-token");
    await storage.saveUserData(mockUser);
    vi.spyOn(authApi, "getCurrentUser").mockResolvedValue(mockUser);

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe("persisted-token");
    expect(state.user).toEqual(mockUser);
  });
});
