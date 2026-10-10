/**
 * Fitness metrics and 1RM (One-Rep Maximum) calculation utilities.
 * Implements scientific formulas: Epley, Brzycki, Lander, Wathan.
 */

export type OneRepMaxFormula = 'epley' | 'brzycki' | 'lander' | 'wathan' | 'average';

export interface OneRepMaxBreakdown {
  epley: number;
  brzycki: number;
  lander: number;
  wathan: number;
  average: number;
}

export interface IntensityZone {
  percentage: number;
  weight: number;
  recommendedReps: string;
}

/**
 * Calculate One-Rep Maximum (1RM) using Epley's formula.
 * Formula: 1RM = weight * (1 + reps / 30)
 */
export function calculateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/**
 * Calculate One-Rep Maximum (1RM) using Brzycki's formula.
 * Formula: 1RM = weight / (1.0278 - 0.0278 * reps)
 */
export function calculateBrzyckiOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  if (reps >= 37) return 0; // Formula diverges for reps >= 37
  return Math.round((weight / (1.0278 - 0.0278 * reps)) * 10) / 10;
}

/**
 * Calculate One-Rep Maximum (1RM) using Lander's formula.
 * Formula: 1RM = (100 * weight) / (101.3 - 2.67123 * reps)
 */
export function calculateLanderOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  const denominator = 101.3 - 2.67123 * reps;
  if (denominator <= 0) return 0;
  return Math.round(((100 * weight) / denominator) * 10) / 10;
}

/**
 * Calculate One-Rep Maximum (1RM) using Wathan's formula.
 * Formula: 1RM = (100 * weight) / (48.8 + 53.8 * exp(-0.075 * reps))
 */
export function calculateWathanOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  const denominator = 48.8 + 53.8 * Math.exp(-0.075 * reps);
  if (denominator <= 0) return 0;
  return Math.round(((100 * weight) / denominator) * 10) / 10;
}

/**
 * Calculate average 1RM across valid scientific formulas.
 */
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

/**
 * Calculate all 1RM estimates using all 4 scientific formulas + average.
 */
export function calculateAllOneRepMaxes(weight: number, reps: number): OneRepMaxBreakdown {
  const epley = calculateOneRepMax(weight, reps);
  const brzycki = calculateBrzyckiOneRepMax(weight, reps);
  const lander = calculateLanderOneRepMax(weight, reps);
  const wathan = calculateWathanOneRepMax(weight, reps);
  const average = calculateAverageOneRepMax(weight, reps);

  return {
    epley,
    brzycki,
    lander,
    wathan,
    average,
  };
}

/**
 * Calculate 1RM by specific formula name.
 */
export function calculate1RMByFormula(
  formula: OneRepMaxFormula,
  weight: number,
  reps: number
): number {
  switch (formula) {
    case 'epley':
      return calculateOneRepMax(weight, reps);
    case 'brzycki':
      return calculateBrzyckiOneRepMax(weight, reps);
    case 'lander':
      return calculateLanderOneRepMax(weight, reps);
    case 'wathan':
      return calculateWathanOneRepMax(weight, reps);
    case 'average':
    default:
      return calculateAverageOneRepMax(weight, reps);
  }
}

/**
 * Calculate training intensity zones based on estimated 1RM.
 */
export function calculateIntensityZones(oneRepMax: number): IntensityZone[] {
  if (oneRepMax <= 0) return [];

  const zones: { pct: number; reps: string }[] = [
    { pct: 100, reps: '1' },
    { pct: 95, reps: '2' },
    { pct: 90, reps: '3 - 4' },
    { pct: 85, reps: '5 - 6' },
    { pct: 80, reps: '7 - 8' },
    { pct: 75, reps: '9 - 10' },
    { pct: 70, reps: '11 - 12' },
    { pct: 65, reps: '13 - 15' },
  ];

  return zones.map((z) => ({
    percentage: z.pct,
    weight: Math.round(((oneRepMax * z.pct) / 100) * 10) / 10,
    recommendedReps: z.reps,
  }));
}

/**
 * Calculate total tonnage lifted for a set.
 */
export function calculateSetTonnage(weight: number, sets: number, reps: number): number {
  if (weight <= 0 || sets <= 0 || reps <= 0) return 0;
  return Math.round(weight * sets * reps * 10) / 10;
}

/**
 * Format kilograms into readable metric display (e.g. 1,250 kg or 12.5 t).
 */
export function formatWeight(kg: number): string {
  if (kg >= 10000) {
    return `${(kg / 1000).toFixed(1)} t`;
  }
  return `${kg.toLocaleString('en-US', { maximumFractionDigits: 1 })} kg`;
}
