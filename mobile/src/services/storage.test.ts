import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "../types";
import {
  clearAuthSession,
  deleteAuthToken,
  deleteUserData,
  getAuthToken,
  getUserData,
  saveAuthToken,
  saveUserData,
} from "./storage";

const mockUser: User = {
  id: "test-user-id-123",
  email: "lifter@irontracker.io",
  username: "IronLifter",
  created_at: "2026-10-10T10:00:00Z",
  updated_at: "2026-10-10T10:00:00Z",
};

describe("Storage Service", () => {
  beforeEach(async () => {
    await clearAuthSession();
  });

  it("should save, retrieve and delete auth token", async () => {
    expect(await getAuthToken()).toBeNull();

    await saveAuthToken("secret-jwt-token-xyz");
    expect(await getAuthToken()).toBe("secret-jwt-token-xyz");

    await deleteAuthToken();
    expect(await getAuthToken()).toBeNull();
  });

  it("should save, retrieve and delete user data", async () => {
    expect(await getUserData()).toBeNull();

    await saveUserData(mockUser);
    const retrieved = await getUserData();
    expect(retrieved).toEqual(mockUser);

    await deleteUserData();
    expect(await getUserData()).toBeNull();
  });

  it("should clear entire session at once", async () => {
    await saveAuthToken("token-to-clear");
    await saveUserData(mockUser);

    expect(await getAuthToken()).toBe("token-to-clear");
    expect(await getUserData()).toEqual(mockUser);

    await clearAuthSession();

    expect(await getAuthToken()).toBeNull();
    expect(await getUserData()).toBeNull();
  });
});
