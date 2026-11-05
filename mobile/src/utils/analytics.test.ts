import { describe, expect, it } from "vitest";
import type {
  OneRepMaxPoint,
  VolumeTrendPoint,
  WorkoutSessionResponse,
} from "../types";
import {
  calculatePersonalRecords,
  computeLineProgressionChartData,
  computeVolumeBarChartData,
  extractOneRepMaxHistory,
  extractVolumeTrend,
  formatDateShort,
  getAvailableExerciseNames,
  isExerciseMatch,
} from "./analytics";

describe("analytics utilities", () => {
  const mockSessions: WorkoutSessionResponse[] = [
    {
      id: "session-1",
      user_id: "user-1",
      title: "Leg Day",
      date: "2026-10-01T10:00:00Z",
      duration_minutes: 60,
      total_tonnage: 5000,
      exercises: [
        {
          exercise_id: "ex-squat",
          exercise_name: "Приседания со штангой",
          exercise_type: "strength",
          sets: [
            { set_number: 1, weight: 60, reps: 10, is_warmup: true },
            { set_number: 2, weight: 120, reps: 5, is_warmup: false }, // 1RM: 120 * (1 + 5/30) = 140
            { set_number: 3, weight: 130, reps: 3, is_warmup: false }, // 1RM: 130 * (1 + 3/30) = 143
          ],
        },
        {
          exercise_id: "ex-bench",
          exercise_name: "Жим лежа",
          exercise_type: "strength",
          sets: [
            { set_number: 1, weight: 80, reps: 8, is_warmup: false }, // 1RM: 80 * (1 + 8/30) = 101.3
          ],
        },
      ],
      created_at: "2026-10-01T11:00:00Z",
      updated_at: "2026-10-01T11:00:00Z",
    },
    {
      id: "session-2",
      user_id: "user-1",
      title: "Upper Power",
      date: "2026-10-15T18:00:00Z",
      duration_minutes: 75,
      total_tonnage: 6200,
      exercises: [
        {
          exercise_id: "ex-bench",
          exercise_name: "Жим лежа на скамье",
          exercise_type: "strength",
          sets: [
            { set_number: 1, weight: 90, reps: 6, is_warmup: false }, // 1RM: 90 * (1 + 6/30) = 108
            { set_number: 2, weight: 100, reps: 3, is_warmup: false }, // 1RM: 100 * (1 + 3/30) = 110
          ],
        },
        {
          exercise_id: "ex-deadlift",
          exercise_name: "Становая тяга",
          exercise_type: "strength",
          sets: [
            { set_number: 1, weight: 160, reps: 3, is_warmup: false }, // 1RM: 160 * (1 + 3/30) = 176
            { set_number: 2, weight: 170, reps: 1, is_warmup: false }, // 1RM: 170
          ],
        },
      ],
      created_at: "2026-10-15T19:00:00Z",
      updated_at: "2026-10-15T19:00:00Z",
    },
    {
      id: "session-3",
      user_id: "user-1",
      title: "Chest PR Day",
      date: "2026-11-01T12:00:00Z",
      duration_minutes: 50,
      total_tonnage: 4500,
      exercises: [
        {
          exercise_id: "ex-bench",
          exercise_name: "Жим лежа",
          exercise_type: "strength",
          sets: [
            { set_number: 1, weight: 105, reps: 5, is_warmup: false }, // 1RM: 105 * (1 + 5/30) = 122.5
          ],
        },
      ],
      created_at: "2026-11-01T13:00:00Z",
      updated_at: "2026-11-01T13:00:00Z",
    },
  ];

  describe("isExerciseMatch", () => {
    it("matches exact strings case-insensitively", () => {
      expect(isExerciseMatch("Жим штанги лежа", "жим штанги лежа")).toBe(true);
      expect(isExerciseMatch("Squat", "squat")).toBe(true);
    });

    it("matches multi-word queries with word overlap", () => {
      expect(isExerciseMatch("Жим штанги лежа", "Жим лежа")).toBe(true);
      expect(isExerciseMatch("Приседания со штангой", "Приседания")).toBe(true);
      expect(isExerciseMatch("Армейский жим стоя", "Армейский жим")).toBe(true);
    });

    it("returns false for unrelated exercises", () => {
      expect(isExerciseMatch("Подтягивания", "Жим лежа")).toBe(false);
      expect(isExerciseMatch("Становая тяга", "Приседания")).toBe(false);
      expect(isExerciseMatch(undefined, "Жим")).toBe(false);
      expect(isExerciseMatch("Жим", null)).toBe(false);
    });
  });

  describe("formatDateShort", () => {
    it("formats valid ISO date into DD.MM format", () => {
      const formatted = formatDateShort("2026-10-15T18:00:00Z");
      expect(formatted).toMatch(/^\d{2}\.\d{2}$/);
    });

    it("returns empty string for undefined or null or invalid input", () => {
      expect(formatDateShort(undefined)).toBe("");
      expect(formatDateShort(null)).toBe("");
      expect(formatDateShort("invalid-date-string")).toBe("");
    });
  });

  describe("getAvailableExerciseNames", () => {
    it("collects unique sorted exercise names from sessions", () => {
      const names = getAvailableExerciseNames(mockSessions);
      expect(names).toContain("Жим лежа");
      expect(names).toContain("Жим лежа на скамье");
      expect(names).toContain("Приседания со штангой");
      expect(names).toContain("Становая тяга");
      expect(names.length).toBe(4);
    });

    it("returns empty array for empty sessions", () => {
      expect(getAvailableExerciseNames([])).toEqual([]);
    });
  });

  describe("extractOneRepMaxHistory", () => {
    it("extracts 1RM points for bench press matching exercise query case-insensitively", () => {
      const points = extractOneRepMaxHistory(mockSessions, "жим");

      expect(points).toHaveLength(3);
      // Chronological order verification
      expect(points[0].date).toBe("2026-10-01T10:00:00Z");
      expect(points[0].weight).toBe(80);
      expect(points[0].reps).toBe(8);
      expect(points[0].oneRepMax).toBe(101.3);

      expect(points[1].date).toBe("2026-10-15T18:00:00Z");
      expect(points[1].weight).toBe(100);
      expect(points[1].reps).toBe(3);
      expect(points[1].oneRepMax).toBe(110);

      expect(points[2].date).toBe("2026-11-01T12:00:00Z");
      expect(points[2].weight).toBe(105);
      expect(points[2].reps).toBe(5);
      expect(points[2].oneRepMax).toBe(122.5);

      // Formula breakdown should be present
      expect(points[2].formulaBreakdown).toBeDefined();
      expect(points[2].formulaBreakdown.epley).toBe(122.5);
      expect(points[2].formulaBreakdown.brzycki).toBeGreaterThan(0);
      expect(points[2].formulaBreakdown.average).toBeGreaterThan(0);
    });

    it("ignores warmup sets when working sets are available", () => {
      const points = extractOneRepMaxHistory(mockSessions, "присед");
      expect(points).toHaveLength(1);
      // Set 1 (warmup 60x10) should not override 130x3
      expect(points[0].weight).toBe(130);
      expect(points[0].reps).toBe(3);
      expect(points[0].oneRepMax).toBe(143);
    });

    it("returns empty array for non-matching query or empty query", () => {
      expect(extractOneRepMaxHistory(mockSessions, "подтягивания")).toEqual([]);
      expect(extractOneRepMaxHistory(mockSessions, "")).toEqual([]);
      expect(extractOneRepMaxHistory([], "жим")).toEqual([]);
    });

    it("sorts unsorted sessions chronologically", () => {
      // Reverse session order
      const reversed = [...mockSessions].reverse();
      const points = extractOneRepMaxHistory(reversed, "жим");

      expect(points[0].date).toBe("2026-10-01T10:00:00Z");
      expect(points[1].date).toBe("2026-10-15T18:00:00Z");
      expect(points[2].date).toBe("2026-11-01T12:00:00Z");
    });
  });

  describe("extractVolumeTrend", () => {
    it("extracts session volumes chronologically", () => {
      const trend = extractVolumeTrend(mockSessions);

      expect(trend).toHaveLength(3);
      expect(trend[0].volume).toBe(5000);
      expect(trend[0].title).toBe("Leg Day");
      expect(trend[1].volume).toBe(6200);
      expect(trend[2].volume).toBe(4500);
    });

    it("calculates fallback volume from sets if total_tonnage is 0", () => {
      const sessionWithZeroTonnage: WorkoutSessionResponse = {
        id: "session-zero",
        user_id: "user-1",
        title: "Arms",
        date: "2026-11-02T10:00:00Z",
        total_tonnage: 0,
        exercises: [
          {
            exercise_id: "ex-biceps",
            exercise_name: "Bicep Curls",
            exercise_type: "strength",
            sets: [
              { set_number: 1, weight: 20, reps: 10, is_warmup: false }, // 200 kg
              { set_number: 2, weight: 25, reps: 8, is_warmup: false },  // 200 kg
            ],
          },
        ],
        created_at: "2026-11-02T11:00:00Z",
        updated_at: "2026-11-02T11:00:00Z",
      };

      const trend = extractVolumeTrend([sessionWithZeroTonnage]);
      expect(trend[0].volume).toBe(400);
    });

    it("returns empty array for empty sessions list", () => {
      expect(extractVolumeTrend([])).toEqual([]);
    });
  });

  describe("calculatePersonalRecords", () => {
    it("calculates career PRs and totals correctly", () => {
      const prs = calculatePersonalRecords(mockSessions);

      // Best 1RM across all exercises is Deadlift 160x3 -> 176 kg
      expect(prs.bestOneRepMax).toBeDefined();
      expect(prs.bestOneRepMax?.exerciseName).toBe("Становая тяга");
      expect(prs.bestOneRepMax?.oneRepMax).toBe(176);

      // Max absolute weight is Deadlift 170 kg
      expect(prs.maxWeightLifted).toBeDefined();
      expect(prs.maxWeightLifted?.weight).toBe(170);
      expect(prs.maxWeightLifted?.exerciseName).toBe("Становая тяга");

      // Max session tonnage is session 2 (6200 kg)
      expect(prs.maxSessionTonnage).toBeDefined();
      expect(prs.maxSessionTonnage?.tonnage).toBe(6200);
      expect(prs.maxSessionTonnage?.title).toBe("Upper Power");

      // Total all time tonnage: 5000 + 6200 + 4500 = 15700
      expect(prs.totalAllTimeTonnage).toBe(15700);
      expect(prs.totalSessionsCount).toBe(3);

      // Working sets count:
      // Session 1: 2 (squat non-warmup) + 1 (bench) = 3
      // Session 2: 2 (bench) + 2 (deadlift) = 4
      // Session 3: 1 (bench) = 1
      // Total: 8
      expect(prs.totalWorkingSetsCount).toBe(8);
    });

    it("handles empty sessions gracefully without errors", () => {
      const emptyPrs = calculatePersonalRecords([]);

      expect(emptyPrs.bestOneRepMax).toBeNull();
      expect(emptyPrs.maxWeightLifted).toBeNull();
      expect(emptyPrs.maxSessionTonnage).toBeNull();
      expect(emptyPrs.totalAllTimeTonnage).toBe(0);
      expect(emptyPrs.totalSessionsCount).toBe(0);
      expect(emptyPrs.totalWorkingSetsCount).toBe(0);
    });
  });

  describe("computeLineProgressionChartData", () => {
    const innerWidth = 300;
    const innerHeight = 150;
    const paddingLeft = 40;
    const paddingTop = 20;

    const createPoint = (orm: number, date = "2026-11-01T10:00:00Z"): OneRepMaxPoint => ({
      date,
      formattedDate: "01.11",
      weight: orm,
      reps: 1,
      oneRepMax: orm,
      formulaBreakdown: {
        epley: orm,
        brzycki: orm,
        lander: orm,
        wathan: orm,
        average: orm,
      },
      exerciseName: "Жим лежа",
    });

    it("returns empty coordinates and fallback ranges when data is empty", () => {
      const res = computeLineProgressionChartData([], innerWidth, innerHeight, paddingLeft, paddingTop);
      expect(res.coordinates).toHaveLength(0);
      expect(res.pathD).toBe("");
      expect(res.areaD).toBe("");
      expect(res.yTicks).toHaveLength(0);
      expect(res.minVal).toBe(0);
      expect(res.maxVal).toBe(100);
    });

    it("handles single data point gracefully without division by zero", () => {
      const point = createPoint(100);
      const res = computeLineProgressionChartData([point], innerWidth, innerHeight, paddingLeft, paddingTop);

      expect(res.coordinates).toHaveLength(1);
      const coord = res.coordinates[0];

      // Horizontally centered
      expect(coord.x).toBe(paddingLeft + innerWidth / 2);
      // Vertically centered because min = 90, max = 110, (100 - 90)/20 = 0.5
      expect(coord.y).toBe(paddingTop + innerHeight / 2);
      expect(Number.isFinite(coord.x)).toBe(true);
      expect(Number.isFinite(coord.y)).toBe(true);

      // Path is a short horizontal cap
      expect(res.pathD).toContain(`M ${coord.x - 20} ${coord.y} L ${coord.x + 20} ${coord.y}`);
      expect(res.areaD).toContain("Z");
      expect(res.yTicks).toHaveLength(3);
    });

    it("handles multiple points with identical min and max values (zero delta)", () => {
      // 3 identical points: min === max
      const points = [
        createPoint(120, "2026-10-01T10:00:00Z"),
        createPoint(120, "2026-10-10T10:00:00Z"),
        createPoint(120, "2026-10-20T10:00:00Z"),
      ];
      const res = computeLineProgressionChartData(points, innerWidth, innerHeight, paddingLeft, paddingTop);

      expect(res.coordinates).toHaveLength(3);
      // Min and max are expanded by 10
      expect(res.minVal).toBe(110);
      expect(res.maxVal).toBe(130);

      for (const coord of res.coordinates) {
        expect(Number.isFinite(coord.x)).toBe(true);
        expect(Number.isFinite(coord.y)).toBe(true);
        expect(coord.y).toBe(paddingTop + innerHeight / 2);
      }

      // X coordinates correctly spaced
      expect(res.coordinates[0].x).toBe(paddingLeft);
      expect(res.coordinates[1].x).toBe(paddingLeft + innerWidth / 2);
      expect(res.coordinates[2].x).toBe(paddingLeft + innerWidth);

      // SVG path connects all 3 points
      expect(res.pathD.startsWith("M")).toBe(true);
      expect(res.pathD.split(" L ")).toHaveLength(3);
      expect(res.areaD.endsWith("Z")).toBe(true);
    });

    it("computes ascending progression with valid boundary coordinates", () => {
      const points = [
        createPoint(80, "2026-10-01T10:00:00Z"),
        createPoint(100, "2026-10-15T10:00:00Z"),
        createPoint(120, "2026-11-01T10:00:00Z"),
      ];
      const res = computeLineProgressionChartData(points, innerWidth, innerHeight, paddingLeft, paddingTop);

      expect(res.coordinates).toHaveLength(3);
      // Highest 1RM point should have smallest Y (top of SVG chart)
      expect(res.coordinates[2].y).toBeLessThan(res.coordinates[0].y);
      // Lowest 1RM point should have largest Y (bottom of SVG chart)
      expect(res.coordinates[0].y).toBeGreaterThan(res.coordinates[2].y);

      // All points within canvas
      for (const coord of res.coordinates) {
        expect(coord.x).toBeGreaterThanOrEqual(paddingLeft);
        expect(coord.x).toBeLessThanOrEqual(paddingLeft + innerWidth);
        expect(coord.y).toBeGreaterThanOrEqual(paddingTop);
        expect(coord.y).toBeLessThanOrEqual(paddingTop + innerHeight);
      }
    });
  });

  describe("computeVolumeBarChartData", () => {
    const innerWidth = 320;
    const innerHeight = 160;
    const paddingLeft = 45;
    const paddingTop = 20;

    const createTrendPoint = (id: string, vol: number): VolumeTrendPoint => ({
      id,
      date: "2026-11-01T10:00:00Z",
      formattedDate: "01.11",
      volume: vol,
      exerciseCount: 3,
      durationMinutes: 60,
      title: "Силовая тренировка",
    });

    it("returns empty bars when visibleData is empty", () => {
      const res = computeVolumeBarChartData([], innerWidth, innerHeight, paddingLeft, paddingTop);
      expect(res.bars).toHaveLength(0);
      expect(res.maxVolume).toBe(1000);
      expect(res.yTicks).toHaveLength(0);
    });

    it("handles single bar correctly with clamped width and centered layout", () => {
      const point = createTrendPoint("1", 5000);
      const res = computeVolumeBarChartData([point], innerWidth, innerHeight, paddingLeft, paddingTop);

      expect(res.bars).toHaveLength(1);
      const bar = res.bars[0];

      expect(bar.width).toBeLessThanOrEqual(32);
      expect(bar.width).toBeGreaterThanOrEqual(16);
      expect(bar.height).toBeGreaterThan(10);
      expect(Number.isFinite(bar.x)).toBe(true);
      expect(Number.isFinite(bar.y)).toBe(true);
      expect(Number.isFinite(bar.centerX)).toBe(true);
    });

    it("handles zero volume sessions without division by zero", () => {
      const point = createTrendPoint("zero", 0);
      const res = computeVolumeBarChartData([point], innerWidth, innerHeight, paddingLeft, paddingTop);

      expect(res.bars).toHaveLength(1);
      const bar = res.bars[0];

      // Minimum bar height 4px to maintain visual touchpoint
      expect(bar.height).toBe(4);
      expect(res.maxVolume).toBeGreaterThan(0);
      expect(Number.isFinite(bar.y)).toBe(true);
    });

    it("computes correct bar spacing and scale for multiple sessions", () => {
      const points = [
        createTrendPoint("s1", 2000),
        createTrendPoint("s2", 4000),
        createTrendPoint("s3", 6000),
      ];
      const res = computeVolumeBarChartData(points, innerWidth, innerHeight, paddingLeft, paddingTop);

      expect(res.bars).toHaveLength(3);
      expect(res.bars[0].height).toBeLessThan(res.bars[2].height);
      // X coordinates must be strictly increasing
      expect(res.bars[1].x).toBeGreaterThan(res.bars[0].x);
      expect(res.bars[2].x).toBeGreaterThan(res.bars[1].x);

      // Y ticks
      expect(res.yTicks).toHaveLength(3);
      expect(res.yTicks[0].val).toBe(res.maxVolume);
      expect(res.yTicks[2].val).toBe(0);
    });
  });
});
