import type {
  OneRepMaxPoint,
  PersonalRecordsSummary,
  VolumeTrendPoint,
  WorkoutSessionResponse,
} from "../types";
import {
  calculateAllOneRepMaxes,
  calculateDetailedSetsTonnage,
  calculateOneRepMax,
} from "./fitness";

/**
 * Formats ISO date string to compact day/month representation (e.g. "05.11" or "05 ноя")
 */
export function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}`;
  } catch {
    return "";
  }
}

/**
 * Extracts a list of unique exercise names present across all workout sessions.
 */
export function getAvailableExerciseNames(
  sessions: WorkoutSessionResponse[]
): string[] {
  const names = new Set<string>();
  for (const session of sessions) {
    if (!session.exercises) continue;
    for (const ex of session.exercises) {
      if (ex.exercise_name && ex.exercise_name.trim().length > 0) {
        names.add(ex.exercise_name.trim());
      }
    }
  }
  return Array.from(names).sort();
}

/**
 * Computes the chronological progression of 1RM for a specific exercise query.
 * For each session containing matching exercise, extracts the peak 1RM set.
 */
export function extractOneRepMaxHistory(
  sessions: WorkoutSessionResponse[],
  exerciseQuery: string
): OneRepMaxPoint[] {
  if (!exerciseQuery || exerciseQuery.trim().length === 0) {
    return [];
  }

  const queryLower = exerciseQuery.trim().toLowerCase();
  const points: OneRepMaxPoint[] = [];

  for (const session of sessions) {
    const rawDate = session.date || session.created_at;
    if (!rawDate) continue;

    const matchingExercises = (session.exercises || []).filter((ex) =>
      ex.exercise_name?.toLowerCase().includes(queryLower)
    );

    if (matchingExercises.length === 0) continue;

    let bestSetInSession: {
      weight: number;
      reps: number;
      oneRepMax: number;
      exerciseName: string;
    } | null = null;

    for (const ex of matchingExercises) {
      const sets = ex.sets || [];
      // Filter out warmups if valid working sets exist
      const validSets = sets.filter((s) => s.weight > 0 && s.reps > 0);
      const workingSets = validSets.filter((s) => !s.is_warmup);
      const candidateSets = workingSets.length > 0 ? workingSets : validSets;

      for (const s of candidateSets) {
        const orm = calculateOneRepMax(s.weight, s.reps);
        if (!bestSetInSession || orm > bestSetInSession.oneRepMax) {
          bestSetInSession = {
            weight: s.weight,
            reps: s.reps,
            oneRepMax: orm,
            exerciseName: ex.exercise_name,
          };
        }
      }
    }

    if (bestSetInSession && bestSetInSession.oneRepMax > 0) {
      points.push({
        date: rawDate,
        formattedDate: formatDateShort(rawDate),
        weight: bestSetInSession.weight,
        reps: bestSetInSession.reps,
        oneRepMax: bestSetInSession.oneRepMax,
        formulaBreakdown: calculateAllOneRepMaxes(
          bestSetInSession.weight,
          bestSetInSession.reps
        ),
        exerciseName: bestSetInSession.exerciseName,
      });
    }
  }

  // Sort chronologically ascending (oldest to newest)
  return points.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Extracts session volume trend data sorted chronologically.
 */
export function extractVolumeTrend(
  sessions: WorkoutSessionResponse[]
): VolumeTrendPoint[] {
  if (!sessions || sessions.length === 0) return [];

  const points: VolumeTrendPoint[] = [];

  for (const session of sessions) {
    const rawDate = session.date || session.created_at;
    if (!rawDate) continue;

    // Calculate tonnage if total_tonnage is absent or 0
    let sessionVolume = session.total_tonnage ?? 0;
    if (sessionVolume <= 0 && session.exercises) {
      for (const ex of session.exercises) {
        if (ex.sets) {
          sessionVolume += calculateDetailedSetsTonnage(ex.sets);
        }
      }
    }

    points.push({
      id: session.id,
      date: rawDate,
      formattedDate: formatDateShort(rawDate),
      volume: Math.round(sessionVolume * 10) / 10,
      exerciseCount: session.exercises ? session.exercises.length : 0,
      durationMinutes: session.duration_minutes ?? null,
      title: session.title || "Тренировка",
    });
  }

  // Sort chronologically ascending
  return points.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Calculates career Personal Records (PRs) across all workout sessions:
 * - Best calculated 1RM across any exercise
 * - Heaviest absolute weight lifted
 * - Highest single-session tonnage
 * - Total lifetime volume & working sets count
 */
export function calculatePersonalRecords(
  sessions: WorkoutSessionResponse[]
): PersonalRecordsSummary {
  const summary: PersonalRecordsSummary = {
    bestOneRepMax: null,
    maxWeightLifted: null,
    maxSessionTonnage: null,
    totalAllTimeTonnage: 0,
    totalSessionsCount: sessions.length,
    totalWorkingSetsCount: 0,
  };

  for (const session of sessions) {
    const rawDate = session.date || session.created_at || "";

    // Tonnage calculation
    let sessionTonnage = session.total_tonnage ?? 0;
    if (sessionTonnage <= 0 && session.exercises) {
      for (const ex of session.exercises) {
        if (ex.sets) {
          sessionTonnage += calculateDetailedSetsTonnage(ex.sets);
        }
      }
    }
    sessionTonnage = Math.round(sessionTonnage * 10) / 10;
    summary.totalAllTimeTonnage += sessionTonnage;

    if (
      sessionTonnage > 0 &&
      (!summary.maxSessionTonnage ||
        sessionTonnage > summary.maxSessionTonnage.tonnage)
    ) {
      summary.maxSessionTonnage = {
        tonnage: sessionTonnage,
        date: rawDate,
        title: session.title || "Рекордная тренировка",
      };
    }

    // Inspect individual exercises and sets
    if (!session.exercises) continue;

    for (const ex of session.exercises) {
      if (!ex.sets) continue;

      for (const set of ex.sets) {
        if (set.weight > 0 && set.reps > 0) {
          if (!set.is_warmup) {
            summary.totalWorkingSetsCount += 1;
          }

          // Check absolute max weight
          if (
            !summary.maxWeightLifted ||
            set.weight > summary.maxWeightLifted.weight
          ) {
            summary.maxWeightLifted = {
              exerciseName: ex.exercise_name,
              weight: set.weight,
              reps: set.reps,
              date: rawDate,
            };
          }

          // Check 1RM (only working sets or sets not marked warmup)
          const set1RM = calculateOneRepMax(set.weight, set.reps);
          if (
            set1RM > 0 &&
            (!summary.bestOneRepMax || set1RM > summary.bestOneRepMax.oneRepMax)
          ) {
            summary.bestOneRepMax = {
              exerciseName: ex.exercise_name,
              weight: set.weight,
              reps: set.reps,
              oneRepMax: set1RM,
              date: rawDate,
            };
          }
        }
      }
    }
  }

  summary.totalAllTimeTonnage =
    Math.round(summary.totalAllTimeTonnage * 10) / 10;

  return summary;
}

export interface LineChartCoordinate {
  x: number;
  y: number;
  point: OneRepMaxPoint;
  index: number;
}

export interface LineChartCalculations {
  minVal: number;
  maxVal: number;
  coordinates: LineChartCoordinate[];
  pathD: string;
  areaD: string;
  yTicks: Array<{ val: number; y: number }>;
}

/**
 * Computes coordinate geometry and SVG paths for LineProgressionChart.
 * Handles single points, identical min/max, and boundary conditions without division by zero.
 */
export function computeLineProgressionChartData(
  data: OneRepMaxPoint[],
  innerWidth: number,
  innerHeight: number,
  paddingLeft = 40,
  paddingTop = 20
): LineChartCalculations {
  if (data.length === 0) {
    return {
      minVal: 0,
      maxVal: 100,
      coordinates: [],
      pathD: "",
      areaD: "",
      yTicks: [],
    };
  }

  const values = data.map((d) => d.oneRepMax);
  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    min = Math.max(0, min - 10);
    max = max + 10;
  } else {
    const margin = (max - min) * 0.15;
    min = Math.max(0, Math.floor(min - margin));
    max = Math.ceil(max + margin);
  }

  const range = max - min || 1;

  // Y ticks (3 ticks: min, mid, max)
  const mid = Math.round((min + max) / 2);
  const ticks = [
    { val: max, y: paddingTop },
    { val: mid, y: paddingTop + innerHeight / 2 },
    { val: min, y: paddingTop + innerHeight },
  ];

  const coords = data.map((point, index) => {
    const x =
      data.length === 1
        ? paddingLeft + innerWidth / 2
        : paddingLeft + (index / (data.length - 1)) * innerWidth;
    const y =
      paddingTop + innerHeight - ((point.oneRepMax - min) / range) * innerHeight;
    return { x, y, point, index };
  });

  let linePath = "";
  let areaPath = "";

  if (coords.length === 1) {
    linePath = `M ${coords[0].x - 20} ${coords[0].y} L ${coords[0].x + 20} ${coords[0].y}`;
    areaPath = `M ${coords[0].x - 20} ${coords[0].y} L ${coords[0].x + 20} ${coords[0].y} L ${coords[0].x + 20} ${paddingTop + innerHeight} L ${coords[0].x - 20} ${paddingTop + innerHeight} Z`;
  } else if (coords.length > 1) {
    linePath = coords.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, "");

    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const bottomY = paddingTop + innerHeight;
    areaPath = `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }

  return {
    minVal: min,
    maxVal: max,
    coordinates: coords,
    pathD: linePath,
    areaD: areaPath,
    yTicks: ticks,
  };
}

export interface VolumeBarCalculations {
  maxVolume: number;
  bars: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    item: VolumeTrendPoint;
    index: number;
    centerX: number;
  }>;
  yTicks: Array<{ val: number; y: number }>;
}

/**
 * Computes coordinate geometry and bar dimensions for VolumeBarChart.
 * Handles zero values, single points, and width constraints.
 */
export function computeVolumeBarChartData(
  visibleData: VolumeTrendPoint[],
  innerWidth: number,
  innerHeight: number,
  paddingLeft = 45,
  paddingTop = 20
): VolumeBarCalculations {
  if (visibleData.length === 0) {
    return { maxVolume: 1000, bars: [], yTicks: [] };
  }

  const volumes = visibleData.map((d) => d.volume);
  let max = Math.max(...volumes);
  if (max <= 0) max = 1000;
  // Add 10% headroom
  max = Math.ceil((max * 1.1) / 100) * 100;

  const count = visibleData.length;
  const barSpacing = 8;
  const totalSpacing = barSpacing * (count + 1);
  const calculatedBarWidth = Math.min(
    32,
    Math.max(16, (innerWidth - totalSpacing) / count)
  );

  // Compute Y ticks (min, mid, max)
  const ticks = [
    { val: max, y: paddingTop },
    { val: Math.round(max / 2), y: paddingTop + innerHeight / 2 },
    { val: 0, y: paddingTop + innerHeight },
  ];

  const slotWidth = innerWidth / count;

  const computedBars = visibleData.map((item, index) => {
    const barHeight = Math.max(4, (item.volume / max) * innerHeight);
    const x =
      paddingLeft + index * slotWidth + (slotWidth - calculatedBarWidth) / 2;
    const y = paddingTop + innerHeight - barHeight;

    return {
      x,
      y,
      width: calculatedBarWidth,
      height: barHeight,
      item,
      index,
      centerX: x + calculatedBarWidth / 2,
    };
  });

  return {
    maxVolume: max,
    bars: computedBars,
    yTicks: ticks,
  };
}

