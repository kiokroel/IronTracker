import { describe, it, expect } from 'vitest';
import {
  calculateOneRepMax,
  calculateBrzyckiOneRepMax,
  calculateLanderOneRepMax,
  calculateWathanOneRepMax,
  calculateAverageOneRepMax,
  calculateAllOneRepMaxes,
  calculateIntensityZones,
  calculateSetTonnage,
  calculateDetailedSetsTonnage,
  formatWeight,
  calculate1RMByFormula,
} from './fitness';

describe('One-Rep Maximum (1RM) Formulas & Utilities', () => {
  describe('calculateOneRepMax (Epley formula)', () => {
    it('returns exact weight for a single repetition (1RM test)', () => {
      expect(calculateOneRepMax(100, 1)).toBe(100);
      expect(calculateOneRepMax(142.5, 1)).toBe(142.5);
    });

    it('correctly calculates 1RM for standard rep ranges', () => {
      // 100 kg x 10 reps -> 100 * (1 + 10/30) = 133.33 -> 133.3 kg
      expect(calculateOneRepMax(100, 10)).toBe(133.3);
      // 120 kg x 5 reps -> 120 * (1 + 5/30) = 140.0 kg
      expect(calculateOneRepMax(120, 5)).toBe(140);
    });

    it('returns 0 for non-positive weight or repetitions', () => {
      expect(calculateOneRepMax(0, 5)).toBe(0);
      expect(calculateOneRepMax(-10, 5)).toBe(0);
      expect(calculateOneRepMax(100, 0)).toBe(0);
      expect(calculateOneRepMax(100, -2)).toBe(0);
    });
  });

  describe('calculateBrzyckiOneRepMax', () => {
    it('returns exact weight for 1 rep', () => {
      expect(calculateBrzyckiOneRepMax(100, 1)).toBe(100);
    });

    it('correctly calculates 1RM within normal working range', () => {
      // 100 kg x 5 reps -> 100 / (1.0278 - 0.0278 * 5) = 100 / 0.8888 = 112.5 kg
      expect(calculateBrzyckiOneRepMax(100, 5)).toBe(112.5);
    });

    it('handles divergence for reps >= 37 safely by returning 0', () => {
      expect(calculateBrzyckiOneRepMax(100, 37)).toBe(0);
      expect(calculateBrzyckiOneRepMax(100, 50)).toBe(0);
    });

    it('returns 0 for negative or zero parameters', () => {
      expect(calculateBrzyckiOneRepMax(0, 10)).toBe(0);
      expect(calculateBrzyckiOneRepMax(100, 0)).toBe(0);
    });
  });

  describe('calculateLanderOneRepMax', () => {
    it('returns exact weight for 1 rep', () => {
      expect(calculateLanderOneRepMax(100, 1)).toBe(100);
    });

    it('calculates 1RM accurately for intermediate sets', () => {
      // 100 kg x 5 reps -> 10000 / (101.3 - 2.67123 * 5) = 10000 / 87.94385 = 113.7
      expect(calculateLanderOneRepMax(100, 5)).toBe(113.7);
    });

    it('returns 0 on edge case invalid inputs', () => {
      expect(calculateLanderOneRepMax(-50, 5)).toBe(0);
      expect(calculateLanderOneRepMax(100, 0)).toBe(0);
    });
  });

  describe('calculateWathanOneRepMax', () => {
    it('returns exact weight for 1 rep', () => {
      expect(calculateWathanOneRepMax(100, 1)).toBe(100);
    });

    it('calculates 1RM accurately with exponential decay model', () => {
      // 100 kg x 5 reps -> 10000 / (48.8 + 53.8 * exp(-0.375))
      const result = calculateWathanOneRepMax(100, 5);
      expect(result).toBeGreaterThan(115);
      expect(result).toBeLessThan(120);
    });
  });

  describe('calculateAverageOneRepMax & calculateAllOneRepMaxes', () => {
    it('computes average across all scientific models', () => {
      const avg = calculateAverageOneRepMax(100, 5);
      expect(avg).toBeGreaterThan(110);
      expect(avg).toBeLessThan(125);
    });

    it('breakdown includes all 4 models and the composite average', () => {
      const breakdown = calculateAllOneRepMaxes(100, 5);
      expect(breakdown).toHaveProperty('epley');
      expect(breakdown).toHaveProperty('brzycki');
      expect(breakdown).toHaveProperty('lander');
      expect(breakdown).toHaveProperty('wathan');
      expect(breakdown).toHaveProperty('average');
      expect(breakdown.average).toBeGreaterThan(100);
    });
  });

  describe('calculateIntensityZones', () => {
    it('generates percentage zones based on 1RM', () => {
      const zones = calculateIntensityZones(100);
      expect(zones.length).toBe(8);
      const zone95 = zones.find((z) => z.percentage === 95);
      expect(zone95).toBeDefined();
      expect(zone95?.weight).toBe(95);

      const zone70 = zones.find((z) => z.percentage === 70);
      expect(zone70).toBeDefined();
      expect(zone70?.weight).toBe(70);
    });

    it('returns empty array if 1RM is non-positive', () => {
      expect(calculateIntensityZones(0)).toEqual([]);
      expect(calculateIntensityZones(-100)).toEqual([]);
    });
  });

  describe('calculateSetTonnage & formatWeight & calculate1RMByFormula', () => {
    it('calculates total tonnage as weight * sets * reps', () => {
      expect(calculateSetTonnage(100, 5, 5)).toBe(2500);
      expect(calculateSetTonnage(82.5, 4, 8)).toBe(2640);
      expect(calculateSetTonnage(0, 4, 8)).toBe(0);
    });

    it('formats weights with appropriate precision and kg suffix', () => {
      expect(formatWeight(100)).toBe('100 kg');
      expect(formatWeight(107.5)).toBe('107.5 kg');
      expect(formatWeight(12500)).toBe('12.5 t');
    });

    it('calculates 1RM via calculate1RMByFormula correctly', () => {
      expect(calculate1RMByFormula('epley', 100, 10)).toBe(133.3);
      expect(calculate1RMByFormula('brzycki', 100, 5)).toBe(112.5);
      expect(calculate1RMByFormula('average', 100, 5)).toBeGreaterThan(110);
    });
  });

  describe('calculateDetailedSetsTonnage', () => {
    it('calculates tonnage strictly for working sets, excluding warmup sets', () => {
      const sets = [
        { weight: 60, reps: 10, is_warmup: true },
        { weight: 100, reps: 5, is_warmup: false },
        { weight: 120, reps: 3, is_warmup: false },
      ];
      // 100*5 + 120*3 = 500 + 360 = 860
      expect(calculateDetailedSetsTonnage(sets)).toBe(860);
    });

    it('returns 0 when all sets are warmups', () => {
      const sets = [
        { weight: 40, reps: 10, is_warmup: true },
        { weight: 60, reps: 8, is_warmup: true },
      ];
      expect(calculateDetailedSetsTonnage(sets)).toBe(0);
    });

    it('handles sets without explicit is_warmup as working sets', () => {
      const sets = [
        { weight: 100, reps: 5 },
        { weight: 100, reps: 5 },
      ];
      expect(calculateDetailedSetsTonnage(sets)).toBe(1000);
    });

    it('returns 0 for empty array or invalid numbers', () => {
      expect(calculateDetailedSetsTonnage([])).toBe(0);
      expect(calculateDetailedSetsTonnage([{ weight: -50, reps: 5, is_warmup: false }])).toBe(0);
      expect(calculateDetailedSetsTonnage([{ weight: 100, reps: 0, is_warmup: false }])).toBe(0);
    });
  });
});
