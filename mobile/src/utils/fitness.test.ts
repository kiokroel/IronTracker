import { describe, expect, it } from "vitest";
import {
  calculateAllOneRepMaxes,
  calculateAverageOneRepMax,
  calculateBrzyckiOneRepMax,
  calculateDetailedSetsTonnage,
  calculateLanderOneRepMax,
  calculateOneRepMax,
  calculateWathanOneRepMax,
  formatWeight,
} from "./fitness";

describe("Fitness calculations", () => {
  it("should calculate Epley 1RM accurately", () => {
    expect(calculateOneRepMax(100, 1)).toBe(100);
    expect(calculateOneRepMax(100, 5)).toBe(116.7);
    expect(calculateOneRepMax(0, 5)).toBe(0);
    expect(calculateOneRepMax(100, 0)).toBe(0);
  });

  it("should calculate Brzycki 1RM accurately", () => {
    expect(calculateBrzyckiOneRepMax(100, 1)).toBe(100);
    expect(calculateBrzyckiOneRepMax(100, 5)).toBe(112.5);
    expect(calculateBrzyckiOneRepMax(100, 37)).toBe(0);
  });

  it("should calculate Lander and Wathan 1RM", () => {
    expect(calculateLanderOneRepMax(100, 1)).toBe(100);
    expect(calculateWathanOneRepMax(100, 1)).toBe(100);
  });

  it("should calculate average 1RM", () => {
    const avg = calculateAverageOneRepMax(100, 5);
    expect(avg).toBeGreaterThan(110);
    expect(avg).toBeLessThan(125);
  });

  it("should return all 1RM breakdowns", () => {
    const breakdown = calculateAllOneRepMaxes(100, 5);
    expect(breakdown.epley).toBe(116.7);
    expect(breakdown.brzycki).toBe(112.5);
    expect(breakdown.average).toBeGreaterThan(0);
  });

  it("should calculate detailed sets tonnage excluding warmups", () => {
    const sets = [
      { weight: 60, reps: 10, is_warmup: true },
      { weight: 100, reps: 5, is_warmup: false },
      { weight: 100, reps: 5, is_warmup: false },
    ];
    // Warmup 60*10=600 is excluded, working sets 100*5 + 100*5 = 1000
    expect(calculateDetailedSetsTonnage(sets)).toBe(1000);
  });

  it("should format weight correctly", () => {
    expect(formatWeight(100)).toBe("100 kg");
    expect(formatWeight(12500)).toBe("12.5 t");
  });
});
