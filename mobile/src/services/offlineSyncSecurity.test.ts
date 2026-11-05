import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as workoutsApi from "../api/workouts";
import {
  clearSyncQueue,
  enqueueWorkoutSession,
  getSyncQueue,
  getSyncQueueCount,
  getSyncQueueStorageKey,
  processSyncQueue,
} from "./syncQueue";
import type { WorkoutSessionCreate, WorkoutSessionResponse } from "../types";

describe("Offline Sync & Android Configuration Security Verification", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  describe("Android and EAS Build Configuration Invariants", () => {
    it("verifies app.json Android package and permissions", () => {
      const appJsonPath = path.resolve(__dirname, "../../app.json");
      expect(fs.existsSync(appJsonPath)).toBe(true);

      const appConfig = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
      const expo = appConfig.expo;

      expect(expo.android).toBeDefined();
      expect(expo.android.package).toBe("com.irontracker.mobile");

      const permissions: string[] = expo.android.permissions;
      expect(permissions).toContain("INTERNET");
      expect(permissions).toContain("ACCESS_NETWORK_STATE");
      expect(permissions).toContain("WAKE_LOCK");
      expect(permissions).toContain("VIBRATE");

      expect(expo.androidStatusBar).toBeDefined();
      expect(expo.androidStatusBar.backgroundColor).toBe("#09090b");
      expect(expo.androidNavigationBar).toBeDefined();
    });

    it("verifies eas.json preview profile builds standalone APK", () => {
      const easJsonPath = path.resolve(__dirname, "../../eas.json");
      expect(fs.existsSync(easJsonPath)).toBe(true);

      const easConfig = JSON.parse(fs.readFileSync(easJsonPath, "utf-8"));
      expect(easConfig.build).toBeDefined();
      expect(easConfig.build.preview).toBeDefined();
      expect(easConfig.build.preview.distribution).toBe("internal");
      expect(easConfig.build.preview.android?.buildType).toBe("apk");
    });
  });

  describe("Sync Queue Security & Data Isolation", () => {
    const sensitiveTestPayload: WorkoutSessionCreate = {
      title: "Leg Day Heavy Squats",
      duration_minutes: 60,
      notes: "Post-workout hydration note",
      exercises: [
        {
          exercise_name: "Squat",
          exercise_type: "strength",
          sets: [
            { set_number: 1, weight: 140, reps: 5, is_warmup: false },
            { set_number: 2, weight: 140, reps: 5, is_warmup: false },
          ],
        },
      ],
    };

    it("ensures no auth tokens or credentials are stored in syncQueue payload", async () => {
      const userUuid = "athlete-safe-uuid-123";
      await enqueueWorkoutSession(sensitiveTestPayload, userUuid);

      const storageKey = getSyncQueueStorageKey(userUuid);
      const rawStoredData = await AsyncStorage.getItem(storageKey);
      expect(rawStoredData).not.toBeNull();

      // Ensure storage does not leak Bearer tokens, passwords, or secret credentials
      expect(rawStoredData).not.toMatch(/Bearer/i);
      expect(rawStoredData).not.toMatch(/"access_token"/i);
      expect(rawStoredData).not.toMatch(/"password"/i);
      expect(rawStoredData).not.toMatch(/"secret"/i);
    });

    it("guarantees per-user isolation: User B cannot access User A's pending sessions", async () => {
      const userA = "athlete-A-uuid";
      const userB = "athlete-B-uuid";

      await enqueueWorkoutSession(
        { ...sensitiveTestPayload, title: "Workout A" },
        userA
      );
      await enqueueWorkoutSession(
        { ...sensitiveTestPayload, title: "Workout B" },
        userB
      );

      const queueA = await getSyncQueue(userA);
      const queueB = await getSyncQueue(userB);

      expect(queueA).toHaveLength(1);
      expect(queueB).toHaveLength(1);

      expect(queueA[0].data.title).toBe("Workout A");
      expect(queueB[0].data.title).toBe("Workout B");
      expect(queueA[0].userId).toBe(userA);
      expect(queueB[0].userId).toBe(userB);

      // Clearing User A's queue leaves User B's queue completely intact
      await clearSyncQueue(userA);
      expect(await getSyncQueueCount(userA)).toBe(0);
      expect(await getSyncQueueCount(userB)).toBe(1);
    });

    it("recovers gracefully from corrupted JSON in AsyncStorage without throwing unhandled exceptions", async () => {
      const storageKey = getSyncQueueStorageKey("user-corrupt-test");
      await AsyncStorage.setItem(storageKey, "{ INVALID_CORRUPTED_JSON_STRING");

      // getSyncQueue must catch parsing error and return empty array
      const queue = await getSyncQueue("user-corrupt-test");
      expect(queue).toEqual([]);
      expect(await getSyncQueueCount("user-corrupt-test")).toBe(0);
    });
  });

  describe("Network Failure Resiliency & Retry Lifecycle", () => {
    const workoutPayload: WorkoutSessionCreate = {
      title: "Bench Day",
      duration_minutes: 50,
      exercises: [
        {
          exercise_name: "Bench Press",
          exercise_type: "strength",
          sets: [{ set_number: 1, weight: 100, reps: 5, is_warmup: false }],
        },
      ],
    };

    const mockSuccessResponse: WorkoutSessionResponse = {
      id: "session-uuid-success",
      user_id: "user-retry-1",
      title: "Bench Day",
      duration_minutes: 50,
      total_tonnage: 500,
      exercises: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("preserves item, increments retryCount on network failure, then purges upon success", async () => {
      const userId = "user-retry-1";
      await enqueueWorkoutSession(workoutPayload, userId);

      // 1. Initial enqueue state
      let queue = await getSyncQueue(userId);
      expect(queue).toHaveLength(1);
      expect(queue[0].retryCount).toBe(0);
      expect(queue[0].lastError).toBeNull();

      // 2. First failure: Network connection timeout
      const createSpy = vi
        .spyOn(workoutsApi, "createWorkoutSession")
        .mockRejectedValueOnce(new Error("Network connection timed out"));

      const res1 = await processSyncQueue(userId);
      expect(res1.syncedCount).toBe(0);
      expect(res1.failedCount).toBe(1);
      expect(res1.remainingCount).toBe(1);

      queue = await getSyncQueue(userId);
      expect(queue).toHaveLength(1);
      expect(queue[0].retryCount).toBe(1);
      expect(queue[0].lastError).toBe("Network connection timed out");

      // 3. Second failure: 502 Bad Gateway
      createSpy.mockRejectedValueOnce(new Error("502 Bad Gateway"));
      const res2 = await processSyncQueue(userId);
      expect(res2.syncedCount).toBe(0);
      expect(res2.failedCount).toBe(1);
      expect(res2.remainingCount).toBe(1);

      queue = await getSyncQueue(userId);
      expect(queue).toHaveLength(1);
      expect(queue[0].retryCount).toBe(2);
      expect(queue[0].lastError).toBe("502 Bad Gateway");

      // 4. Third attempt: Network recovers -> HTTP 201 Created
      createSpy.mockResolvedValueOnce(mockSuccessResponse);
      const res3 = await processSyncQueue(userId);
      expect(res3.syncedCount).toBe(1);
      expect(res3.failedCount).toBe(0);
      expect(res3.remainingCount).toBe(0);

      // Queue is fully emptied and cleaned from AsyncStorage
      expect(await getSyncQueueCount(userId)).toBe(0);
      const rawAfter = await AsyncStorage.getItem(getSyncQueueStorageKey(userId));
      expect(rawAfter).toBeNull();
    });
  });
});
