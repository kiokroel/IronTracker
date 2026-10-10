import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Workout, isStrengthMetrics, isCardioMetrics } from '@/types/workout';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatWorkoutDate } from '@/utils/date';
import { formatExerciseName } from '@/utils/exercise';
import { useLocaleStore } from '@/store/useLocaleStore';

export interface DeleteWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout | null;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteWorkoutModal: React.FC<DeleteWorkoutModalProps> = ({
  isOpen,
  onClose,
  workout,
  onConfirm,
  isDeleting,
}) => {
  const { t, locale } = useLocaleStore();

  if (!workout) return null;

  const rawExerciseName =
    ('exercise_name' in workout.metrics && workout.metrics.exercise_name) ||
    workout.type ||
    workout.metrics.exercise_type;

  const exerciseName = formatExerciseName(rawExerciseName, t);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('workouts.deleteConfirmTitle')}
      className="max-w-md"
    >
      <div className="space-y-4 mt-2">
        {/* Warning card */}
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 space-y-1">
            <p className="font-semibold text-red-300">
              {t('workouts.deleteConfirmWarningTitle')}
            </p>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              {t('workouts.deleteConfirmWarningDesc')}
            </p>
          </div>
        </div>

        {/* Workout summary */}
        <div className="rounded-lg bg-zinc-950/70 border border-zinc-800 p-3 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">{t('workouts.exerciseLabel')}</span>
            <span className="font-bold text-white tracking-wide">{exerciseName}</span>
          </div>

          {isStrengthMetrics(workout.metrics) && (
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">{t('workouts.setsWeightLabel')}</span>
              <span className="font-bold text-amber-400 font-mono">
                {workout.metrics.sets} {t('common.sets')} × {workout.metrics.reps} {t('common.reps')} @ {workout.metrics.weight} {t('common.kg')}
              </span>
            </div>
          )}

          {isCardioMetrics(workout.metrics) && (
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">{t('workouts.distanceDurationLabel')}</span>
              <span className="font-bold text-cyan-400 font-mono">
                {workout.metrics.distance_km} {t('common.km')} / {workout.metrics.duration_minutes} {t('common.min')}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1 border-t border-zinc-800/60">
            <span className="text-zinc-500 font-medium">{t('workouts.loggedDateLabel')}</span>
            <span className="text-zinc-300 font-mono text-[11px]">
              {formatWorkoutDate(workout.date || workout.created_at, locale === 'ru' ? 'ru-RU' : 'en-US')}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end items-center gap-3 pt-3 border-t border-zinc-800">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            isLoading={isDeleting}
            className="gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            {t('workouts.deleteWorkoutBtn')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteWorkoutModal;
