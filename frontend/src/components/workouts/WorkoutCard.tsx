import React from 'react';
import { Calendar, Flame, Dumbbell, Activity, Heart, Pencil, Trash2, ShieldCheck, Zap } from 'lucide-react';
import { Workout, isStrengthMetrics, isCardioMetrics } from '@/types/workout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { calculateOneRepMax, calculateSetTonnage, formatWeight } from '@/utils/fitness';
import { formatWorkoutDate } from '@/utils/date';
import { useAuthStore } from '@/store/useAuthStore';

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

  // Security (Client IDOR protection): only the owner of the record can edit or delete
  const isOwner = Boolean(currentUser?.id && workout.user_id === currentUser.id);

  const rawType = (workout.type || workout.metrics.exercise_type || '').toLowerCase();

  // Helper for badge styling & label
  const getBadgeConfig = () => {
    if (rawType.includes('bench')) {
      return { label: 'Bench Press', variant: 'accent' as const };
    }
    if (rawType.includes('squat')) {
      return { label: 'Squats', variant: 'success' as const };
    }
    if (rawType.includes('deadlift')) {
      return { label: 'Deadlift', variant: 'crimson' as const };
    }
    if (
      rawType.includes('overhead') ||
      (rawType === 'strength' &&
        'exercise_name' in workout.metrics &&
        workout.metrics.exercise_name.toLowerCase().includes('overhead'))
    ) {
      return { label: 'Overhead Press', variant: 'accent' as const };
    }
    if (rawType.includes('cardio') || rawType.includes('treadmill') || rawType.includes('run')) {
      return { label: 'Cardio', variant: 'default' as const };
    }
    return { label: workout.type || 'Workout', variant: 'default' as const };
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
                Mine
              </span>
            ) : (
              <span className="text-[10px] text-zinc-500 font-mono">
                Athlete: {workout.user_id.slice(0, 8)}...
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
                  title="Edit workout"
                  aria-label="Edit workout"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(workout)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 transition-colors"
                  title="Delete workout"
                  aria-label="Delete workout"
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
          <span className="truncate">
            {(
              ('exercise_name' in workout.metrics && workout.metrics.exercise_name) ||
              workout.type ||
              workout.metrics.exercise_type
            ).replace(/_/g, ' ')}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 px-5 pb-5">
        {isStrengthMetrics(workout.metrics) && (
          <>
            {/* Primary work sets summary */}
            <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/50 p-3 flex justify-between items-center text-sm">
              <span className="text-zinc-400 text-xs font-medium">Work Sets</span>
              <span className="font-bold text-white font-mono tracking-tight text-sm">
                {workout.metrics.sets} × {workout.metrics.reps} @ {workout.metrics.weight} kg
              </span>
            </div>

            {/* Tonnage & 1RM grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-zinc-950/40 border border-zinc-800/40 p-2.5">
                <span className="text-zinc-500 block mb-0.5 text-[11px] font-medium">Tonnage</span>
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
                <span className="text-zinc-500 block mb-0.5 text-[11px] font-medium">Est. 1RM</span>
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  {calculateOneRepMax(workout.metrics.weight, workout.metrics.reps)} kg
                </span>
              </div>
            </div>

            {/* Specific attributes (RPE, Grip width, Stance, Style) */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {workout.metrics.rpe && (
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                  RPE {workout.metrics.rpe}
                </span>
              )}
              {'grip_width_cm' in workout.metrics && workout.metrics.grip_width_cm && (
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">
                  Grip: {workout.metrics.grip_width_cm} cm
                </span>
              )}
              {'stance' in workout.metrics && workout.metrics.stance && (
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 capitalize">
                  Stance: {workout.metrics.stance}
                </span>
              )}
              {'deadlift_style' in workout.metrics && workout.metrics.deadlift_style && (
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 capitalize">
                  Style: {workout.metrics.deadlift_style}
                </span>
              )}
            </div>
          </>
        )}

        {isCardioMetrics(workout.metrics) && (
          <div className="space-y-2">
            <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/50 p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500 block text-[11px]">Distance</span>
                <span className="font-bold text-white font-mono text-sm">
                  {workout.metrics.distance_km} km
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">Duration</span>
                <span className="font-bold text-white font-mono text-sm">
                  {workout.metrics.duration_minutes} min
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {workout.metrics.distance_km > 0 && (
                <div className="rounded-lg bg-zinc-950/40 border border-zinc-800/40 p-2.5">
                  <span className="text-zinc-500 block mb-0.5 text-[11px]">Avg Pace</span>
                  <span className="font-bold text-cyan-400">
                    {(workout.metrics.duration_minutes / workout.metrics.distance_km).toFixed(2)} min/km
                  </span>
                </div>
              )}
              {workout.metrics.heart_rate && (
                <div className="rounded-lg bg-zinc-950/40 border border-zinc-800/40 p-2.5">
                  <span className="text-zinc-500 block mb-0.5 text-[11px]">Heart Rate</span>
                  <span className="font-bold text-rose-400 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 shrink-0" />
                    {workout.metrics.heart_rate} bpm
                  </span>
                </div>
              )}
              {workout.metrics.calories_burned && (
                <div className="rounded-lg bg-zinc-950/40 border border-zinc-800/40 p-2.5">
                  <span className="text-zinc-500 block mb-0.5 text-[11px]">Burned</span>
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 shrink-0" />
                    {workout.metrics.calories_burned} kcal
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Date footer */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/60">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <span>{formatWorkoutDate(workout.date || workout.created_at)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkoutCard;
