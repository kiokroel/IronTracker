import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as workoutsApi from "../api/workouts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearSyncQueue,
  enqueueWorkoutSession,
  getSyncQueue,
  getSyncQueueCount,
  getSyncQueueStorageKey,
  processSyncQueue,
} from "./syncQueue";
import type { WorkoutSessionCreate, WorkoutSessionResponse } from "../types";

describe("syncQueue service", () => {
  const mockSessionData: WorkoutSessionCreate = {
    title: "Вечерний жим",
    duration_minutes: 45,
    exercises: [
      {
        exercise_name: "Жим лежа",
        exercise_type: "strength",
        sets: [{ set_number: 1, weight: 100, reps: 5, is_warmup: false }],
      },
    ],
  };

  const mockSessionResponse: WorkoutSessionResponse = {
    id: "session-uuid-1",
    user_id: "user-1",
    title: "Вечерний жим",
    duration_minutes: 45,
    total_tonnage: 500,
    exercises: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  describe("getSyncQueueStorageKey", () => {
    it("generates per-user isolated key", () => {
      expect(getSyncQueueStorageKey("athlete_123")).toBe(
        "irontracker_sync_queue_athlete_123"
      );
      expect(getSyncQueueStorageKey("user_456")).toBe(
        "irontracker_sync_queue_user_456"
      );
    });

    it("falls back to default key when userId is missing or empty", () => {
      expect(getSyncQueueStorageKey(undefined)).toBe(
        "irontracker_sync_queue_default"
      );
      expect(getSyncQueueStorageKey(null)).toBe(
        "irontracker_sync_queue_default"
      );
      expect(getSyncQueueStorageKey("   ")).toBe(
        "irontracker_sync_queue_default"
      );
    });
  });

  describe("enqueueWorkoutSession", () => {
    it("enqueues session data with proper metadata", async () => {
      const item = await enqueueWorkoutSession(mockSessionData, "user-1");

      expect(item).toBeDefined();
      expect(item.id).toMatch(/^sync_/);
      expect(item.userId).toBe("user-1");
      expect(item.data).toEqual(mockSessionData);
      expect(item.retryCount).toBe(0);
      expect(item.lastError).toBeNull();
      expect(item.createdAt).toBeDefined();

      const queue = await getSyncQueue("user-1");
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe(item.id);
    });

    it("preserves multiple enqueued sessions in FIFO order", async () => {
      const s1 = await enqueueWorkoutSession(
        { ...mockSessionData, title: "Сессия 1" },
        "user-1"
      );
      const s2 = await enqueueWorkoutSession(
        { ...mockSessionData, title: "Сессия 2" },
        "user-1"
      );

      const queue = await getSyncQueue("user-1");
      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe(s1.id);
      expect(queue[1].id).toBe(s2.id);
      expect(queue[0].data.title).toBe("Сессия 1");
      expect(queue[1].data.title).toBe("Сессия 2");
    });
  });

  describe("per-user queue isolation", () => {
    it("keeps queues strictly separate between different user IDs", async () => {
      await enqueueWorkoutSession(
        { ...mockSessionData, title: "Тренировка Юзера 1" },
        "user-1"
      );
      await enqueueWorkoutSession(
        { ...mockSessionData, title: "Тренировка Юзера 2" },
        "user-2"
      );

      const countUser1 = await getSyncQueueCount("user-1");
      const countUser2 = await getSyncQueueCount("user-2");
      const countUser3 = await getSyncQueueCount("user-3");

      expect(countUser1).toBe(1);
      expect(countUser2).toBe(1);
      expect(countUser3).toBe(0);

      const queueUser1 = await getSyncQueue("user-1");
      const queueUser2 = await getSyncQueue("user-2");
      expect(queueUser1[0].data.title).toBe("Тренировка Юзера 1");
      expect(queueUser2[0].data.title).toBe("Тренировка Юзера 2");
    });
  });

  describe("processSyncQueue", () => {
    it("returns zero counts when queue is empty", async () => {
      const result = await processSyncQueue("user-1");
      expect(result).toEqual({
        syncedCount: 0,
        failedCount: 0,
        remainingCount: 0,
      });
    });

    it("successfully sends sessions via createWorkoutSession and empties queue", async () => {
      const createSpy = vi
        .spyOn(workoutsApi, "createWorkoutSession")
        .mockResolvedValue(mockSessionResponse);

      await enqueueWorkoutSession(mockSessionData, "user-1");
      await enqueueWorkoutSession(
        { ...mockSessionData, title: "Сессия 2" },
        "user-1"
      );

      expect(await getSyncQueueCount("user-1")).toBe(2);

      const result = await processSyncQueue("user-1");

      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        syncedCount: 2,
        failedCount: 0,
        remainingCount: 0,
      });

      expect(await getSyncQueueCount("user-1")).toBe(0);
    });

    it("retains failed sessions, increments retryCount and records lastError", async () => {
      const createSpy = vi
        .spyOn(workoutsApi, "createWorkoutSession")
        .mockRejectedValue(new Error("503 Service Unavailable"));

      await enqueueWorkoutSession(mockSessionData, "user-1");

      const result = await processSyncQueue("user-1");

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        syncedCount: 0,
        failedCount: 1,
        remainingCount: 1,
      });

      const queue = await getSyncQueue("user-1");
      expect(queue).toHaveLength(1);
      expect(queue[0].retryCount).toBe(1);
      expect(queue[0].lastError).toBe("503 Service Unavailable");
    });

    it("handles partial failure: removes successful items and keeps failed items", async () => {
      const createSpy = vi
        .spyOn(workoutsApi, "createWorkoutSession")
        .mockResolvedValueOnce(mockSessionResponse)
        .mockRejectedValueOnce(new Error("Network connection dropped"));

      await enqueueWorkoutSession(
        { ...mockSessionData, title: "Успешная" },
        "user-1"
      );
      await enqueueWorkoutSession(
        { ...mockSessionData, title: "Неудачная" },
        "user-1"
      );

      const result = await processSyncQueue("user-1");

      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        syncedCount: 1,
        failedCount: 1,
        remainingCount: 1,
      });

      const remaining = await getSyncQueue("user-1");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].data.title).toBe("Неудачная");
      expect(remaining[0].retryCount).toBe(1);
      expect(remaining[0].lastError).toBe("Network connection dropped");
    });
  });

  describe("clearSyncQueue", () => {
    it("clears all items in queue for target user", async () => {
      await enqueueWorkoutSession(mockSessionData, "user-1");
      await enqueueWorkoutSession(mockSessionData, "user-2");

      await clearSyncQueue("user-1");

      expect(await getSyncQueueCount("user-1")).toBe(0);
      expect(await getSyncQueueCount("user-2")).toBe(1);
    });
  });
});
