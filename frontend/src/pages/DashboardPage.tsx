import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Trophy, Flame, TrendingUp, Plus, ArrowUpRight, Award } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { workoutsApi } from '@/api/workouts';
import { leaderboardApi } from '@/api/leaderboard';
import { Workout } from '@/types/workout';
import { UserRankResponse } from '@/types/leaderboard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { calculateOneRepMax, formatWeight } from '@/utils/fitness';
import { formatWorkoutDate } from '@/utils/date';
import { formatExerciseName } from '@/utils/exercise';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { t, locale } = useLocaleStore();
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
    return <Loader fullScreen text={t('common.loading')} />;
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 p-6 sm:p-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-amber-500 uppercase">
              {t('dashboard.title')}
            </span>
            <Badge variant="accent" size="sm">{t('dashboard.active')}</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            {t('common.appName')}, <span className="text-amber-500">{user?.username}</span>!
          </h1>
          <p className="text-sm text-zinc-400">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/workouts">
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-1.5" />
              <span>{t('dashboard.quickLog')}</span>
            </Button>
          </Link>
          <Link to="/leaderboard">
            <Button variant="secondary" size="md">
              <Trophy className="w-4 h-4 mr-1.5 text-amber-500" />
              <span>{t('nav.leaderboard')}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workouts */}
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-zinc-400">
              {t('dashboard.statTotalWorkouts')}
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Dumbbell className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{totalWorkouts}</div>
            <p className="text-xs text-zinc-400 mt-1">{t('workouts.sessions')}</p>
          </CardContent>
        </Card>

        {/* Total Tonnage */}
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-zinc-400">
              {t('dashboard.statTotalVolume')}
            </CardTitle>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
              <Flame className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{formatWeight(totalTonnage)}</div>
            <p className="text-xs text-zinc-400 mt-1">{t('workouts.tonnage')}</p>
          </CardContent>
        </Card>

        {/* Global Rank */}
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-zinc-400">
              {t('dashboard.statCurrentRank')}
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Trophy className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">
              {userRank?.rank ? `#${userRank.rank}` : t('leaderboard.unranked')}
            </div>
            <p className="text-xs text-zinc-400 mt-1">{t('leaderboard.title')}</p>
          </CardContent>
        </Card>

        {/* Max Estimated 1RM */}
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-zinc-400">
              {t('analytics.best1RM')}
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">
              {best1RM > 0 ? `${best1RM} ${t('common.kg')}` : t('common.na')}
            </div>
            <p className="text-xs text-zinc-400 mt-1 capitalize truncate">
              {formatExerciseName(bestExercise, t)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Workouts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{t('dashboard.recentWorkouts')}</h2>
            <p className="text-xs text-zinc-400">{t('dashboard.subtitle')}</p>
          </div>
          <Link
            to="/workouts"
            className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>{t('dashboard.viewAll')}</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {workouts.length === 0 ? (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 mb-3">
              <Award className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">{t('workouts.noWorkouts')}</h3>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
              {t('workouts.noWorkoutsDesc')}
            </p>
            <Link to="/workouts">
              <Button variant="primary" size="md">
                <Plus className="w-4 h-4 mr-1.5" />
                <span>{t('workouts.logWorkout')}</span>
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
                      {formatExerciseName(workout.type || workout.metrics.exercise_type, t)}
                    </Badge>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {formatWorkoutDate(workout.date || workout.created_at, locale === 'ru' ? 'ru-RU' : 'en-US')}
                    </span>
                  </div>
                  <CardTitle className="text-base capitalize mt-2">
                    {formatExerciseName(workout.type || workout.metrics.exercise_type, t)}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {'detailed_sets' in workout.metrics && workout.metrics.detailed_sets && workout.metrics.detailed_sets.length > 0 ? (() => {
                      const dSets = workout.metrics.detailed_sets;
                      const wSets = dSets.filter((s) => !s.is_warmup);
                      const warmupsCount = dSets.length - wSets.length;
                      const candidate = wSets.length > 0 ? wSets : dSets;
                      const topSet = candidate.reduce((p, c) => (c.weight > p.weight ? c : p), candidate[0]);
                      return (
                        <span className="block text-zinc-300">
                          <span className="font-semibold text-white">
                            {topSet.weight} {t('common.kg')} × {topSet.reps} {t('common.reps')}
                          </span>
                          {wSets.length > 1 && (
                            <span className="text-zinc-400"> ({wSets.length} {t('workouts.workingCount')})</span>
                          )}
                          {warmupsCount > 0 && (
                            <span className="text-amber-400/90"> · {warmupsCount} {t('workouts.warmupCount')}</span>
                          )}
                        </span>
                      );
                    })() : 'weight' in workout.metrics && 'sets' in workout.metrics && 'reps' in workout.metrics ? (
                      <>
                        {workout.metrics.weight} {t('common.kg')} × {workout.metrics.sets} {t('common.sets')} × {workout.metrics.reps} {t('common.reps')}
                      </>
                    ) : 'distance_km' in workout.metrics ? (
                      <>
                        {workout.metrics.distance_km} {t('common.km')} / {workout.metrics.duration_minutes} {t('common.min')}
                      </>
                    ) : (
                      t('dashboard.recordedSession')
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {'detailed_sets' in workout.metrics && workout.metrics.detailed_sets && workout.metrics.detailed_sets.length > 0 ? (() => {
                    const dSets = workout.metrics.detailed_sets;
                    const wSets = dSets.filter((s) => !s.is_warmup);
                    const candidate = wSets.length > 0 ? wSets : dSets;
                    const best1rm = Math.max(...candidate.map((s) => calculateOneRepMax(s.weight, s.reps)));
                    return (
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-800/80 text-zinc-400">
                        <span>{t('analytics.estimatedMax')}</span>
                        <span className="font-bold text-amber-400">
                          {best1rm} {t('common.kg')}
                        </span>
                      </div>
                    );
                  })() : 'weight' in workout.metrics && 'reps' in workout.metrics ? (
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-800/80 text-zinc-400">
                      <span>{t('analytics.estimatedMax')}</span>
                      <span className="font-bold text-amber-400">
                        {calculateOneRepMax(workout.metrics.weight, workout.metrics.reps)} {t('common.kg')}
                      </span>
                    </div>
                  ) : null}
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
