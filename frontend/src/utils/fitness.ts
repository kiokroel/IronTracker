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
