import React, { useState } from 'react';
import {
  Calendar,
  Flame,
  Dumbbell,
  Activity,
  Pencil,
  Trash2,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  Heart,
} from 'lucide-react';
import {
  WorkoutSession,
} from '@/types/workoutSession';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatWeight, calculateOneRepMax } from '@/utils/fitness';
import { formatWorkoutDate } from '@/utils/date';
import { formatExerciseName } from '@/utils/exercise';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';

export interface WorkoutSessionCardProps {
  session: WorkoutSession;
  onEdit?: (session: WorkoutSession) => void;
  onDelete?: (session: WorkoutSession) => void;
}

export const WorkoutSessionCard: React.FC<WorkoutSessionCardProps> = ({
  session,
  onEdit,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const currentUser = useAuthStore((state) => state.user);
  const { t, locale } = useLocaleStore();

  const isOwner = Boolean(currentUser?.id && session.user_id === currentUser.id);

  // Calculate session working sets count
  const totalWorkingSets = session.exercises.reduce((acc, ex) => {
    if (ex.exercise_type === 'strength' || ex.exercise_type === 'bodyweight') {
      return acc + ex.sets.filter((s) => !s.is_warmup).length;
    }
    return acc;
  }, 0);

  const totalWarmupSets = session.exercises.reduce((acc, ex) => {
    if (ex.exercise_type === 'strength' || ex.exercise_type === 'bodyweight') {
      return acc + ex.sets.filter((s) => s.is_warmup).length;
    }
    return acc;
  }, 0);

  return (
    <Card className="group relative border-zinc-800 bg-zinc-900/90 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/50 transition-all duration-200">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="accent" size="sm" className="gap-1 font-bold">
              <Layers className="w-3 h-3 text-amber-400" />
              <span>{t('workouts.complexSession')}</span>
            </Badge>

            {isOwner ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                {t('workouts.mine')}
              </span>
            ) : (
              <span className="text-[10px] text-zinc-500 font-mono">
                {t('workouts.athlete', { id: `${session.user_id.slice(0, 8)}...` })}
              </span>
            )}

            {session.duration_minutes && (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-mono bg-zinc-800/60 px-2 py-0.5 rounded-md border border-zinc-700/50">
                <Clock className="w-3 h-3 text-zinc-400" />
                {session.duration_minutes} {t('common.min')}
              </span>
            )}
          </div>

          {/* Action buttons */}
          {isOwner && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(session)}
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
                  onClick={() => onDelete(session)}
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

        <CardTitle className="text-base font-bold capitalize mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-white font-black tracking-tight">
              {session.title || t('workouts.complexSession')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors font-medium p-1 rounded"
          >
            <span>{isExpanded ? t('workouts.hideSetsDetails') : t('workouts.viewSetsDetails')}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        {/* Session Stats summary strip */}
        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-center">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
              {t('workouts.tonnage')}
            </span>
            <span className="text-sm font-black font-mono text-red-400 flex items-center justify-center gap-1 mt-0.5">
              <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />
              {formatWeight(session.total_tonnage)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
              {t('workouts.sessionWorkingSets')}
            </span>
            <span className="text-sm font-black font-mono text-white flex items-center justify-center gap-1 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {totalWorkingSets}
              {totalWarmupSets > 0 && (
                <span className="text-[10px] text-amber-400/90 font-sans font-normal">
                  (+{totalWarmupSets})
                </span>
              )}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
              {t('workouts.sessionTotalExercises')}
            </span>
            <span className="text-sm font-black font-mono text-cyan-400 flex items-center justify-center gap-1 mt-0.5">
              <Dumbbell className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {session.exercises.length}
            </span>
          </div>
        </div>

        {/* Exercises list */}
        {isExpanded && (
          <div className="space-y-3 pt-1">
            {session.exercises.map((ex, exIdx) => {
              const isCardio = ex.exercise_type === 'cardio';
              const workingSets = ex.sets.filter((s) => !s.is_warmup);
              const exTonnage = ex.sets.reduce((sum, s) => (s.is_warmup ? sum : sum + s.weight * s.reps), 0);
              const peak1RM = workingSets.length > 0
                ? Math.max(...workingSets.map((s) => calculateOneRepMax(s.weight, s.reps)))
                : 0;

              return (
                <div
                  key={exIdx}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 space-y-2.5 transition-colors hover:border-zinc-700/80"
                >
                  {/* Exercise header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded bg-zinc-800 text-[10px] font-mono font-bold text-zinc-300">
                        {exIdx + 1}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {formatExerciseName(ex.exercise_name, t)}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                        {ex.exercise_type === 'cardio'
                          ? t('workouts.typeCardio')
                          : ex.exercise_type === 'bodyweight'
                          ? t('workouts.typeBodyweight')
                          : t('workouts.typeStrength')}
                      </span>
                    </div>

                    {!isCardio && exTonnage > 0 && (
                      <span className="text-xs font-mono font-bold text-zinc-300">
                        {formatWeight(exTonnage)}
                      </span>
                    )}
                  </div>

                  {/* Exercise sets / cardio */}
                  {!isCardio ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {ex.sets.map((s, sIdx) => {
                          const set1RM = s.weight > 0 && s.reps > 0 ? calculateOneRepMax(s.weight, s.reps) : 0;
                          return (
                            <span
                              key={sIdx}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
                                s.is_warmup
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : 'bg-zinc-900 text-zinc-200 border-zinc-800 font-semibold shadow-sm'
                              }`}
                              title={s.is_warmup ? t('workouts.warmup') : `1RM: ${set1RM} kg`}
                            >
                              <span>
                                {s.is_warmup && <span className="text-amber-400 font-bold mr-0.5">W:</span>}
                                {s.weight} {t('common.kg')} × {s.reps}
                                {s.rpe ? ` @${s.rpe}` : ''}
                              </span>
                            </span>
                          );
                        })}
                      </div>

                      {peak1RM > 0 && (
                        <div className="text-[11px] text-zinc-400 flex items-center gap-1 pt-0.5">
                          <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>
                            {t('workouts.heaviest1RM')}: <strong className="text-amber-400 font-mono">{peak1RM} {t('common.kg')}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Cardio telemetry */
                    <div className="flex flex-wrap gap-3 text-xs text-zinc-300 font-mono pt-1">
                      {ex.distance_km != null && (
                        <span className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded text-cyan-300">
                          <Activity className="w-3 h-3" />
                          {ex.distance_km} {t('common.km')}
                        </span>
                      )}
                      {ex.duration_minutes != null && (
                        <span className="flex items-center gap-1 bg-zinc-800 border border-zinc-700/50 px-2 py-0.5 rounded text-zinc-300">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          {ex.duration_minutes} {t('common.min')}
                        </span>
                      )}
                      {ex.heart_rate != null && (
                        <span className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded text-red-300">
                          <Heart className="w-3 h-3 text-red-400" />
                          {ex.heart_rate} {t('workouts.heartRateLabel')}
                        </span>
                      )}
                      {ex.calories_burned != null && (
                        <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-amber-300">
                          <Flame className="w-3 h-3 text-amber-400" />
                          {ex.calories_burned} {t('workouts.burned')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Exercise notes */}
                  {ex.notes && (
                    <p className="text-xs text-zinc-400 italic bg-zinc-900/40 p-1.5 rounded border border-zinc-800/40">
                      "{ex.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Session overall notes */}
        {session.notes && (
          <div className="text-xs text-zinc-400 italic bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
            <span className="font-semibold text-zinc-300 not-italic mr-1">{t('workouts.sessionNotesLabel')}:</span>
            "{session.notes}"
          </div>
        )}

        {/* Footer date info */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs text-zinc-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>{formatWorkoutDate(session.date || session.created_at, locale)}</span>
          </div>
          <span className="text-[10px] text-zinc-600">ID: {session.id.slice(0, 8)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkoutSessionCard;
