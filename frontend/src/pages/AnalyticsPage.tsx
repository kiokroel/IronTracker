import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Dumbbell,
  Zap,
  Award,
  ChevronRight,
  BarChart2,
} from 'lucide-react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { isStrengthMetrics } from '@/types/workout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import {
  VolumeTrendChart,
  VolumeDataPoint,
} from '@/components/analytics/VolumeTrendChart';
import {
  OneRepMaxProgressionChart,
  ExerciseSetRecord,
} from '@/components/analytics/OneRepMaxProgressionChart';
import { FormulaComparisonCard } from '@/components/analytics/FormulaComparisonCard';
import {
  PersonalRecordsGrid,
  PersonalRecordItem,
} from '@/components/analytics/PersonalRecordsGrid';
import {
  calculateAverageOneRepMax,
  calculateSetTonnage,
  formatWeight,
} from '@/utils/fitness';

export const AnalyticsPage: React.FC = () => {
  const { workouts, isLoading, fetchWorkouts } = useWorkoutStore();

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  // Process data from workouts
  const { volumeData, exerciseRecords, personalRecords, totalTonnage, strengthWorkoutsCount, peak1RM } =
    useMemo(() => {
      const volMap: Record<string, VolumeDataPoint> = {};
      const exRecs: Record<string, ExerciseSetRecord[]> = {
        bench_press: [],
        squat: [],
        deadlift: [],
        overhead_press: [],
      };

      let sumTonnage = 0;
      let countStrength = 0;
      let highest1RM = 0;

      // Sort workouts by date ascending
      const sorted = [...workouts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      for (const w of sorted) {
        const m = w.metrics;
        let sessionVolume = 0;

        if (isStrengthMetrics(m)) {
          countStrength++;
          const tonnage = calculateSetTonnage(m.weight, m.sets, m.reps);
          sessionVolume += tonnage;
          sumTonnage += tonnage;

          const est1RM = calculateAverageOneRepMax(m.weight, m.reps);
          if (est1RM > highest1RM) {
            highest1RM = est1RM;
          }

          // Classify exercise
          const exType = (w.type || m.exercise_type || '').toLowerCase();
          const exName = ('exercise_name' in m ? m.exercise_name : '').toLowerCase();

          const recordItem: ExerciseSetRecord = {
            date: w.date ? w.date.split('T')[0] : 'Unknown',
            weight: m.weight,
            reps: m.reps,
            workoutType: w.type || 'strength',
          };

          if (exType.includes('bench') || exName.includes('bench')) {
            exRecs.bench_press.push(recordItem);
          } else if (exType.includes('squat') || exName.includes('squat')) {
            exRecs.squat.push(recordItem);
          } else if (exType.includes('deadlift') || exName.includes('deadlift')) {
            exRecs.deadlift.push(recordItem);
          } else if (
            exType.includes('overhead') ||
            exName.includes('overhead') ||
            exName.includes('press') ||
            exName.includes('shoulder')
          ) {
            exRecs.overhead_press.push(recordItem);
          }
        }

        const dateKey = w.date ? w.date.split('T')[0] : 'Unknown';
        if (sessionVolume > 0) {
          if (!volMap[dateKey]) {
            volMap[dateKey] = {
              date: dateKey,
              volume: sessionVolume,
              workoutType: w.type || 'strength',
            };
          } else {
            volMap[dateKey].volume += sessionVolume;
          }
        }
      }

      const volumeList: VolumeDataPoint[] = Object.values(volMap).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Compute PRs
      const computePR = (
        id: string,
        name: string,
        category: string,
        recs: ExerciseSetRecord[]
      ): PersonalRecordItem => {
        if (recs.length === 0) {
          return {
            id,
            name,
            category,
            max1RM: 0,
            maxWeight: 0,
            repsAtMax: 0,
            date: '—',
          };
        }

        let best1RM = 0;
        let bestWeight = 0;
        let repsAtBest = 0;
        let dateAtBest = recs[0].date;

        for (const r of recs) {
          const r1rm = calculateAverageOneRepMax(r.weight, r.reps);
          if (r1rm > best1RM) {
            best1RM = r1rm;
            bestWeight = r.weight;
            repsAtBest = r.reps;
            dateAtBest = r.date;
          }
        }

        return {
          id,
          name,
          category,
          max1RM: best1RM,
          maxWeight: bestWeight,
          repsAtMax: repsAtBest,
          date: dateAtBest,
        };
      };

      const prList: PersonalRecordItem[] = [
        computePR('bench', 'Bench Press', 'Upper Body Push', exRecs.bench_press),
        computePR('squat', 'Back Squat', 'Lower Body Quad', exRecs.squat),
        computePR('deadlift', 'Deadlift', 'Posterior Chain', exRecs.deadlift),
        computePR('overhead', 'Overhead Press', 'Vertical Push', exRecs.overhead_press),
      ];

      return {
        volumeData: volumeList,
        exerciseRecords: exRecs,
        personalRecords: prList,
        totalTonnage: sumTonnage,
        strengthWorkoutsCount: countStrength,
        peak1RM: highest1RM,
      };
    }, [workouts]);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">
              Analytics & Progression
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-zinc-400">
            Deep physiological metrics, multi-formula 1RM trends, and personal records.
          </p>
        </div>

        <Link to="/workouts">
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2 border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200"
          >
            <span>Log Workout</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {isLoading && workouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader size="lg" />
          <p className="mt-4 text-sm text-zinc-400">Loading training analytics...</p>
        </div>
      ) : workouts.length === 0 ? (
        <Card className="border-zinc-800 bg-zinc-900/40 p-12 text-center shadow-lg">
          <BarChart2 className="mx-auto h-16 w-16 text-zinc-600" />
          <h2 className="mt-4 text-xl font-bold text-zinc-100">No workout records found</h2>
          <p className="mt-2 max-w-md mx-auto text-sm text-zinc-400">
            Your analytics dashboard will automatically populate with 1RM charts, volume trends, and PR records once you log your first training session.
          </p>
          <div className="mt-6">
            <Link to="/workouts">
              <Button variant="primary">Start Logging Workouts</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-zinc-800 bg-zinc-900/60 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
                    Total Tonnage Lifted
                  </div>
                  <div className="text-2xl font-black font-mono text-zinc-100 mt-0.5">
                    {formatWeight(totalTonnage)}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/60 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
                    Absolute Peak 1RM
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-400 mt-0.5">
                    {peak1RM > 0 ? `${peak1RM} kg` : '—'}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/60 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-400 font-medium">
                    Strength Sets Logged
                  </div>
                  <div className="text-2xl font-black font-mono text-zinc-100 mt-0.5">
                    {strengthWorkoutsCount}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Personal Records Grid */}
          <PersonalRecordsGrid records={personalRecords} />

          {/* Interactive Volume Trend Chart */}
          <VolumeTrendChart data={volumeData} />

          {/* Interactive 1RM Progression Chart */}
          <OneRepMaxProgressionChart records={exerciseRecords} />

          {/* Scientific 1RM Formula Comparison Card */}
          <FormulaComparisonCard />
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
