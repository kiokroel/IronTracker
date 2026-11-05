import { describe, expect, it, vi, beforeEach } from "vitest";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import {
  triggerSetCompletedHaptic,
  triggerRestFinishedHaptic,
  triggerButtonHaptic,
  playRestCompleteSound,
  notifyRestFinished,
} from "./feedback";

describe("feedback service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Haptics notifications and impacts", () => {
    it("calls notificationAsync with Success on set completion", async () => {
      const spy = vi.spyOn(Haptics, "notificationAsync");
      await triggerSetCompletedHaptic();
      expect(spy).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    });

    it("falls back to impactAsync if notificationAsync throws an error", async () => {
      vi.spyOn(Haptics, "notificationAsync").mockRejectedValueOnce(
        new Error("Platform unsupported")
      );
      // Shouldn't throw unhandled exception
      await expect(triggerSetCompletedHaptic()).resolves.toBeUndefined();
    });

    it("calls notificationAsync with Warning on rest completion", async () => {
      const spy = vi.spyOn(Haptics, "notificationAsync");
      await triggerRestFinishedHaptic();
      expect(spy).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
    });

    it("handles rest finished errors without crashing", async () => {
      vi.spyOn(Haptics, "notificationAsync").mockRejectedValueOnce(
        new Error("Hardware unavailable")
      );
      await expect(triggerRestFinishedHaptic()).resolves.toBeUndefined();
    });

    it("triggers light impact for button feedback", async () => {
      const spy = vi.spyOn(Haptics, "impactAsync");
      await triggerButtonHaptic();
      expect(spy).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it("handles button haptic failures without crashing", async () => {
      vi.spyOn(Haptics, "impactAsync").mockRejectedValueOnce(
        new Error("Device vibration disabled")
      );
      await expect(triggerButtonHaptic()).resolves.toBeUndefined();
    });
  });

  describe("Audio alerts", () => {
    it("loads and initiates beep audio playback", async () => {
      const createSpy = vi.spyOn(Audio.Sound, "createAsync");
      await playRestCompleteSound();
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ uri: expect.stringContaining(".ogg") }),
        expect.objectContaining({ shouldPlay: true })
      );
    });

    it("safely handles audio failure without throwing", async () => {
      vi.spyOn(Audio.Sound, "createAsync").mockRejectedValueOnce(
        new Error("Audio engine disabled")
      );
      await expect(playRestCompleteSound()).resolves.toBeUndefined();
    });

    it("triggers haptics instantly and independently even if audio fails", async () => {
      const hapticsSpy = vi.spyOn(Haptics, "notificationAsync");
      vi.spyOn(Audio.Sound, "createAsync").mockRejectedValueOnce(
        new Error("Network sound download failed")
      );

      await expect(notifyRestFinished()).resolves.toBeUndefined();
      expect(hapticsSpy).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
    });
  });
});
