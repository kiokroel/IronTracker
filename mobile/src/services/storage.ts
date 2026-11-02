import * as SecureStore from "expo-secure-store";
import type { User } from "../types";

const TOKEN_KEY = "irontracker_auth_token";
const USER_KEY = "irontracker_user_data";

// In-memory fallback storage for unit testing / environments where SecureStore native module isn't available
const memoryStorage = new Map<string, string>();

async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    if (typeof SecureStore.isAvailableAsync === "function") {
      return await SecureStore.isAvailableAsync();
    }
    return false;
  } catch {
    return false;
  }
}

export async function saveAuthToken(token: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    memoryStorage.set(TOKEN_KEY, token);
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  }
  return memoryStorage.get(TOKEN_KEY) ?? null;
}

export async function deleteAuthToken(): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } else {
    memoryStorage.delete(TOKEN_KEY);
  }
}

export async function saveUserData(user: User): Promise<void> {
  const json = JSON.stringify(user);
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(USER_KEY, json);
  } else {
    memoryStorage.set(USER_KEY, json);
  }
}

export async function getUserData(): Promise<User | null> {
  let json: string | null = null;
  if (await isSecureStoreAvailable()) {
    json = await SecureStore.getItemAsync(USER_KEY);
  } else {
    json = memoryStorage.get(USER_KEY) ?? null;
  }

  if (!json) return null;
  try {
    return JSON.parse(json) as User;
  } catch {
    return null;
  }
}

export async function deleteUserData(): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(USER_KEY);
  } else {
    memoryStorage.delete(USER_KEY);
  }
}

export async function clearAuthSession(): Promise<void> {
  await deleteAuthToken();
  await deleteUserData();
}
