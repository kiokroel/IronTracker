/**
 * Fitness metrics and 1RM (One-Rep Maximum) calculation utilities for IronTracker Mobile.
 * Implements scientific formulas: Epley, Brzycki, Lander, Wathan.
 */

export type OneRepMaxFormula = "epley" | "brzycki" | "lander" | "wathan" | "average";

export interface OneRepMaxBreakdown {
  epley: number;
  brzycki: number;
  lander: number;
  wathan: number;
  average: number;
}

export function calculateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function calculateBrzyckiOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  if (reps >= 37) return 0;
  return Math.round((weight / (1.0278 - 0.0278 * reps)) * 10) / 10;
}

export function calculateLanderOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  const denominator = 101.3 - 2.67123 * reps;
  if (denominator <= 0) return 0;
  return Math.round(((100 * weight) / denominator) * 10) / 10;
}

export function calculateWathanOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  const denominator = 48.8 + 53.8 * Math.exp(-0.075 * reps);
  if (denominator <= 0) return 0;
  return Math.round(((100 * weight) / denominator) * 10) / 10;
}

export function calculateAverageOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;

  const values: number[] = [
    calculateOneRepMax(weight, reps),
    calculateBrzyckiOneRepMax(weight, reps),
    calculateLanderOneRepMax(weight, reps),
    calculateWathanOneRepMax(weight, reps),
  ].filter((v) => v > 0);

  if (values.length === 0) return 0;
  const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function calculateAllOneRepMaxes(weight: number, reps: number): OneRepMaxBreakdown {
  return {
    epley: calculateOneRepMax(weight, reps),
    brzycki: calculateBrzyckiOneRepMax(weight, reps),
    lander: calculateLanderOneRepMax(weight, reps),
    wathan: calculateWathanOneRepMax(weight, reps),
    average: calculateAverageOneRepMax(weight, reps),
  };
}

export function calculateDetailedSetsTonnage(
  sets: Array<{ weight: number; reps: number; is_warmup?: boolean }>
): number {
  if (!sets || sets.length === 0) return 0;
  const workingSets = sets.filter((s) => !s.is_warmup);
  const total = workingSets.reduce((sum, s) => {
    if (s.weight > 0 && s.reps > 0) {
      return sum + s.weight * s.reps;
    }
    return sum;
  }, 0);
  return Math.round(total * 10) / 10;
}

export function formatWeight(kg: number): string {
  if (kg >= 10000) {
    return `${(kg / 1000).toFixed(1)} t`;
  }
  return `${kg.toLocaleString("en-US", { maximumFractionDigits: 1 })} kg`;
}
