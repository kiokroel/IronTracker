import React from 'react';
import { Calendar, Flame, Dumbbell, Activity, Heart, Pencil, Trash2, ShieldCheck, Zap } from 'lucide-react';
import { Workout, isStrengthMetrics, isCardioMetrics } from '@/types/workout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { calculateOneRepMax, calculateSetTonnage, formatWeight } from '@/utils/fitness';
import { formatWorkoutDate } from '@/utils/date';
import { formatExerciseName } from '@/utils/exercise';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';

export interface WorkoutCardProps {
  workout: Workout;
  onEdit?: (workout: Workout) => void;
  onDelete?: (workout: Workout) => void;
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  workout,
  onEdit,
  onDelete,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const { t, locale } = useLocaleStore();

  // Security (Client IDOR protection): only the owner of the record can edit or delete
  const isOwner = Boolean(currentUser?.id && workout.user_id === currentUser.id);

  const rawExerciseName =
    ('exercise_name' in workout.metrics && workout.metrics.exercise_name) ||
    workout.type ||
    workout.metrics.exercise_type;

  const rawType = (rawExerciseName || '').toLowerCase();

  // Helper for badge styling & label
  const getBadgeConfig = () => {
    if (rawType.includes('bench')) {
      return { label: formatExerciseName('bench_press', t), variant: 'accent' as const };
    }
    if (rawType.includes('squat')) {
      return { label: formatExerciseName('squats', t), variant: 'success' as const };
    }
    if (rawType.includes('deadlift')) {
      return { label: formatExerciseName('deadlift', t), variant: 'crimson' as const };
    }
    if (rawType.includes('overhead') || rawType.includes('press')) {
      return { label: formatExerciseName('overhead_press', t), variant: 'accent' as const };
    }
    if (rawType.includes('cardio') || rawType.includes('treadmill') || rawType.includes('run')) {
      return { label: formatExerciseName('cardio', t), variant: 'default' as const };
    }
    return { label: formatExerciseName(rawExerciseName, t), variant: 'default' as const };
  };

  const exerciseTitle = formatExerciseName(rawExerciseName, t);

  const getStanceLabel = (stanceVal: string) => {
    if (stanceVal === 'narrow') return t('workouts.stanceNarrow');
    if (stanceVal === 'medium') return t('workouts.stanceMedium');
    if (stanceVal === 'wide') return t('workouts.stanceWide');
    return stanceVal;
  };

  const getStyleLabel = (styleVal: string) => {
    if (styleVal === 'conventional') return t('workouts.deadliftConventional');
    if (styleVal === 'sumo') return t('workouts.deadliftSumo');
    return styleVal;
  };

  const badgeConfig = getBadgeConfig();

  return (
    <Card className="group relative border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:shadow-lg hover:shadow-black/40 transition-all duration-200">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={badgeConfig.variant} size="sm">
              {badgeConfig.label}
            </Badge>
            {isOwner ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                {t('workouts.mine')}
              </span>
            ) : (
              <span className="text-[10px] text-zinc-500 font-mono">
                {t('workouts.athlete', { id: `${workout.user_id.slice(0, 8)}...` })}
              </span>
            )}
          </div>

          {/* Action buttons (only rendered if user is owner to prevent IDOR confusion) */}
          {isOwner && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(workout)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/80 transition-colors"
                  title={t('workouts.editTitle')}
                  aria-label={t('workouts.editTitle')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(workout)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 transition-colors"
                  title={t('workouts.deleteTitle')}
                  aria-label={t('workouts.deleteTitle')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <CardTitle className="text-base font-bold capitalize mt-2 flex items-center gap-2">
          {isStrengthMetrics(workout.metrics) ? (
            <Dumbbell className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span className="truncate">{exerciseTitle}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 px-5 pb-5">
        {isStrengthMetrics(workout.metrics) && (
          <>
            {/* Primary work sets summary */}
            <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/50 p-3 flex justify-between items-center text-sm">
              <span className="text-zinc-400 text-xs font-medium">{t('workouts.workSets')}</span>
              <span className="font-bold text-white font-mono tracking-tight text-sm">
                {workout.metrics.sets} × {workout.metrics.reps} @ {workout.metrics.weight} {t('common.kg')}
              </span>
            </div>

            {/* Tonnage & 1RM grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-zinc-950/40 border border-zinc-800/40 p-2.5">
                <span className="text-zinc-500 block mb-0.5 text-[11px] font-medium">{t('workouts.tonnage')}</span>
                <span className="font-bold text-red-400 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  {formatWeight(
                    calculateSetTonnage(
                      workout.metrics.weight,
                      workout.metrics.sets,
                      workout.metrics.reps
                    )
                  )}
                </span>
              </div>
              <div className="rounded-lg bg-zinc-950/40 border border-zinc-800/40 p-2.5">
                <span className="text-zinc-500 block mb-0.5 text-[11px] font-medium">{t('workouts.est1RM')}</span>
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  {calculateOneRepMax(workout.metrics.weight, workout.metrics.reps)} {t('common.kg')}
                </span>
              </div>
            </div>

            {/* Specific attributes (RPE, Grip width, Stance, Style) */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {workout.metrics.rpe && (
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                  {t('workouts.rpe', { val: workout.metrics.rpe })}
                </span>
              )}
              {'grip_width_cm' in workout.metrics && workout.metrics.grip_width_cm && (
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">
                  {t('workouts.grip', { val: workout.metrics.grip_width_cm })}
                </span>
              )}
              {'stance' in workout.metrics && workout.metrics.stance && (
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">
                  {t('workouts.stance', { val: getStanceLabel(workout.metrics.stance) })}
                </span>
              )}
              {'deadlift_style' in workout.metrics && workout.metrics.deadlift_style && (
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">
                  {t('workouts.style', { val: getStyleLabel(workout.metrics.deadlift_style) })}
                </span>
              )}
            </div>
          </>
        )}

        {isCardioMetrics(workout.metrics) && (
          <div className="space-y-2">
            <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/50 p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500 block text-[11px]">{t('workouts.distanceLabel')}</span>
                <span className="font-bold text-white font-mono text-sm">
                  {workout.metrics.distance_km} {t('common.km')}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">{t('workouts.durationLabel')}</span>
                <span className="font-bold text-white font-mono text-sm">
                  {workout.metrics.duration_minutes} {t('common.min')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {workout.metrics.distance_km > 0 && (
                <div className="rounded-lg bg-zinc-950/40 border border-zinc-800/40 p-2.5">
                  <span className="text-zinc-500 block mb-0.5 text-[11px]">{t('workouts.avgPace')}</span>
                  <span className="font-bold text-cyan-400">
                    {(workout.metrics.duration_minutes / workout.metrics.distance_km).toFixed(2)} {t('workouts.paceUnit')}
                  </span>
                </div>
              )}
              {workout.metrics.heart_rate && (
                <div className="rounded-lg bg-zinc-950/40 border border-zinc-800/40 p-2.5">
                  <span className="text-zinc-500 block mb-0.5 text-[11px]">{t('workouts.heartRateLabel')}</span>
                  <span className="font-bold text-rose-400 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 shrink-0" />
                    {workout.metrics.heart_rate} {t('common.bpm')}
                  </span>
                </div>
              )}
              {workout.metrics.calories_burned && (
                <div className="rounded-lg bg-zinc-950/40 border border-zinc-800/40 p-2.5">
                  <span className="text-zinc-500 block mb-0.5 text-[11px]">{t('workouts.burned')}</span>
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 shrink-0" />
                    {workout.metrics.calories_burned} {t('common.kcal')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Date footer */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/60">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <span>{formatWorkoutDate(workout.date || workout.created_at, locale === 'ru' ? 'ru-RU' : 'en-US')}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkoutCard;
