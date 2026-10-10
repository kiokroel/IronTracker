import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Trophy, Flame, TrendingUp, Plus, ArrowUpRight, Award } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { workoutsApi } from '@/api/workouts';
import { leaderboardApi } from '@/api/leaderboard';
import { Workout } from '@/types/workout';
import { UserRankResponse } from '@/types/leaderboard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { calculateOneRepMax, formatWeight } from '@/utils/fitness';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [userRank, setUserRank] = useState<UserRankResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [workoutsData, rankData] = await Promise.allSettled([
          workoutsApi.list({ limit: 10 }),
          leaderboardApi.getMyRank(),
        ]);

        if (isMounted) {
          if (workoutsData.status === 'fulfilled') {
            setWorkouts(workoutsData.value);
          }
          if (rankData.status === 'fulfilled') {
            setUserRank(rankData.value);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute stats
  const totalWorkouts = workouts.length;
  const totalTonnage = userRank?.score ?? workouts.reduce((sum, w) => {
    if ('weight' in w.metrics && 'sets' in w.metrics && 'reps' in w.metrics) {
      return sum + w.metrics.weight * w.metrics.sets * w.metrics.reps;
    }
    return sum;
  }, 0);

  // Find max 1RM
  let best1RM = 0;
  let bestExercise = 'None';
  workouts.forEach((w) => {
    if ('weight' in w.metrics && 'reps' in w.metrics) {
      const e1rm = calculateOneRepMax(w.metrics.weight, w.metrics.reps);
      if (e1rm > best1RM) {
        best1RM = e1rm;
        bestExercise = w.type || w.metrics.exercise_type;
      }
    }
  });

  if (isLoading) {
    return <Loader fullScreen text="Loading athlete dashboard..." />;
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 p-6 sm:p-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-amber-500 uppercase">
              Athlete Command Center
            </span>
            <Badge variant="accent" size="sm">Active</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Welcome back, <span className="text-amber-500">{user?.username}</span>!
          </h1>
          <p className="text-sm text-zinc-400">
            Track metrics, analyze volume, and conquer the global leaderboard.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/workouts">
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Log Workout</span>
            </Button>
          </Link>
          <Link to="/leaderboard">
            <Button variant="secondary" size="md">
              <Trophy className="w-4 h-4 mr-1.5 text-amber-500" />
              <span>Leaderboard</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workouts */}
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-zinc-400">Total Workouts</CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Dumbbell className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{totalWorkouts}</div>
            <p className="text-xs text-zinc-400 mt-1">Logged sessions</p>
          </CardContent>
        </Card>

        {/* Total Tonnage */}
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-zinc-400">Total Tonnage</CardTitle>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
              <Flame className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{formatWeight(totalTonnage)}</div>
            <p className="text-xs text-zinc-400 mt-1">Accumulated iron lifted</p>
          </CardContent>
        </Card>

        {/* Global Rank */}
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-zinc-400">Global Rank</CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Trophy className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">
              {userRank?.rank ? `#${userRank.rank}` : 'Unranked'}
            </div>
            <p className="text-xs text-zinc-400 mt-1">In tonnage standings</p>
          </CardContent>
        </Card>

        {/* Max Estimated 1RM */}
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-zinc-400">Peak 1RM</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">
              {best1RM > 0 ? `${best1RM} kg` : 'N/A'}
            </div>
            <p className="text-xs text-zinc-400 mt-1 capitalize truncate">
              {bestExercise.replace('_', ' ')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Workouts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Recent Workouts</h2>
            <p className="text-xs text-zinc-400">Telemetry logs from your latest sessions</p>
          </div>
          <Link
            to="/workouts"
            className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>View all</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {workouts.length === 0 ? (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 mb-3">
              <Award className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">No workouts recorded yet</h3>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
              Hit the iron and record your first workout session to generate telemetry metrics.
            </p>
            <Link to="/workouts">
              <Button variant="primary" size="md">
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Log First Workout</span>
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workouts.slice(0, 6).map((workout) => (
              <Card key={workout.id} className="border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="accent" size="sm">
                      {workout.type || workout.metrics.exercise_type}
                    </Badge>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {new Date(workout.date || workout.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-base capitalize mt-2">
                    {(workout.type || workout.metrics.exercise_type).replace('_', ' ')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {'weight' in workout.metrics && 'sets' in workout.metrics && 'reps' in workout.metrics ? (
                      <>
                        {workout.metrics.weight} kg × {workout.metrics.sets} sets × {workout.metrics.reps} reps
                      </>
                    ) : 'distance_km' in workout.metrics ? (
                      <>
                        {workout.metrics.distance_km} km in {workout.metrics.duration_minutes} min
                      </>
                    ) : (
                      'Recorded session'
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {'weight' in workout.metrics && 'reps' in workout.metrics && (
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-800/80 text-zinc-400">
                      <span>Est. 1RM</span>
                      <span className="font-bold text-amber-400">
                        {calculateOneRepMax(workout.metrics.weight, workout.metrics.reps)} kg
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
