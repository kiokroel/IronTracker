import AsyncStorage from "@react-native-async-storage/async-storage";
import { createWorkoutSession } from "../api/workouts";
import type {
  QueuedWorkoutSession,
  SyncProcessResult,
  WorkoutSessionCreate,
} from "../types";

const activeSyncProcesses = new Set<string>();

/**
 * Returns isolated storage key for the given user's offline queue.
 */
export function getSyncQueueStorageKey(userId?: string | null): string {
  const normalizedId = userId && userId.trim().length > 0 ? userId.trim() : "default";
  return `irontracker_sync_queue_${normalizedId}`;
}

/**
 * Retrieves the full sync queue for a user.
 */
export async function getSyncQueue(
  userId?: string | null
): Promise<QueuedWorkoutSession[]> {
  try {
    const key = getSyncQueueStorageKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedWorkoutSession[];
  } catch {
    return [];
  }
}

/**
 * Returns the number of pending workout sessions awaiting sync.
 */
export async function getSyncQueueCount(
  userId?: string | null
): Promise<number> {
  const queue = await getSyncQueue(userId);
  return queue.length;
}

/**
 * Enqueues a workout session for delayed synchronization.
 */
export async function enqueueWorkoutSession(
  sessionData: WorkoutSessionCreate,
  userId?: string | null
): Promise<QueuedWorkoutSession> {
  const effectiveUserId =
    userId && userId.trim().length > 0 ? userId.trim() : "default";
  const key = getSyncQueueStorageKey(effectiveUserId);

  const queuedItem: QueuedWorkoutSession = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    userId: effectiveUserId,
    data: sessionData,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
  };

  const queue = await getSyncQueue(effectiveUserId);
  queue.push(queuedItem);

  await AsyncStorage.setItem(key, JSON.stringify(queue));
  return queuedItem;
}

/**
 * Processes all queued workout sessions in FIFO order.
 * Items that succeed (HTTP 201 Created) are removed.
 * Items that fail have their retryCount incremented and are kept for the next retry.
 */
export async function processSyncQueue(
  userId?: string | null
): Promise<SyncProcessResult> {
  const effectiveUserId =
    userId && userId.trim().length > 0 ? userId.trim() : "default";
  const key = getSyncQueueStorageKey(effectiveUserId);

  // Prevent concurrent runs for the same user queue
  if (activeSyncProcesses.has(key)) {
    const queue = await getSyncQueue(effectiveUserId);
    return {
      syncedCount: 0,
      failedCount: 0,
      remainingCount: queue.length,
    };
  }

  activeSyncProcesses.add(key);

  try {
    const queue = await getSyncQueue(effectiveUserId);
    if (queue.length === 0) {
      return { syncedCount: 0, failedCount: 0, remainingCount: 0 };
    }

    const remainingQueue: QueuedWorkoutSession[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      try {
        await createWorkoutSession(item.data);
        syncedCount++;
      } catch (err: unknown) {
        failedCount++;
        const errorMessage =
          err instanceof Error
            ? err.message
            : typeof err === "string"
            ? err
            : "Network/Sync request failed";

        remainingQueue.push({
          ...item,
          retryCount: (item.retryCount || 0) + 1,
          lastError: errorMessage,
        });
      }
    }

    if (remainingQueue.length === 0) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(remainingQueue));
    }

    return {
      syncedCount,
      failedCount,
      remainingCount: remainingQueue.length,
    };
  } finally {
    activeSyncProcesses.delete(key);
  }
}

/**
 * Clears the queue for a given user.
 */
export async function clearSyncQueue(userId?: string | null): Promise<void> {
  const key = getSyncQueueStorageKey(userId);
  await AsyncStorage.removeItem(key);
}
