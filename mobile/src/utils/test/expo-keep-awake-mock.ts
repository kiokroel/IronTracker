export const ExpoKeepAwakeTag = "ExpoKeepAwakeDefaultTag";

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export async function activateKeepAwakeAsync(_tag?: string): Promise<void> {
  // Mock no-op
}

export async function deactivateKeepAwake(_tag?: string): Promise<void> {
  // Mock no-op
}

export function useKeepAwake(_tag?: string): void {
  // Mock no-op
}

export default {
  ExpoKeepAwakeTag,
  isAvailableAsync,
  activateKeepAwakeAsync,
  deactivateKeepAwake,
  useKeepAwake,
};
