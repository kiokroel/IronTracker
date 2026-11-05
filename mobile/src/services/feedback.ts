import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";

/**
 * Triggers haptic feedback when a set is completed.
 */
export async function triggerSetCompletedHaptic(): Promise<void> {
  try {
    if (Haptics && typeof Haptics.notificationAsync === "function") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (Haptics && typeof Haptics.impactAsync === "function") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  } catch {
    // Haptics unavailable on simulator/web or permission denied
  }
}

/**
 * Triggers haptic feedback when rest timer completes.
 */
export async function triggerRestFinishedHaptic(): Promise<void> {
  try {
    if (Haptics && typeof Haptics.notificationAsync === "function") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (Haptics && typeof Haptics.impactAsync === "function") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch {
    // Haptics unavailable
  }
}

/**
 * Triggers subtle haptic feedback for regular button clicks/taps.
 */
export async function triggerButtonHaptic(): Promise<void> {
  try {
    if (Haptics && typeof Haptics.impactAsync === "function") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Haptics unavailable
  }
}

/**
 * Plays an audio beep when rest countdown completes (if audio module is supported).
 */
export async function playRestCompleteSound(): Promise<void> {
  try {
    if (Audio && Audio.Sound && typeof Audio.Sound.createAsync === "function") {
      const { sound } = await Audio.Sound.createAsync(
        { uri: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg" },
        { shouldPlay: true, volume: 1.0 }
      );
      if (sound && typeof sound.setOnPlaybackStatusUpdate === "function") {
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status && "didJustFinish" in status && status.didJustFinish) {
            sound.unloadAsync().catch(() => {});
          }
        });
      }
    }
  } catch {
    // Audio playback fallback - haptic feedback is independent and reliable
  }
}

/**
 * Triggers rest completion feedback: executes native vibration (Haptics)
 * instantly and completely independently from audio streaming/playback.
 */
export async function notifyRestFinished(): Promise<void> {
  const hapticPromise = triggerRestFinishedHaptic().catch(() => {});
  const audioPromise = playRestCompleteSound().catch(() => {});
  await Promise.allSettled([hapticPromise, audioPromise]);
}

export const feedbackService = {
  triggerSetCompletedHaptic,
  triggerRestFinishedHaptic,
  triggerButtonHaptic,
  playRestCompleteSound,
  notifyRestFinished,
};

export default feedbackService;
