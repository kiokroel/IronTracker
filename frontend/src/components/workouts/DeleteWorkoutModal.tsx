import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Workout, isStrengthMetrics, isCardioMetrics } from '@/types/workout';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatWorkoutDate } from '@/utils/date';

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
  if (!workout) return null;

  const exerciseName = (workout.type || workout.metrics.exercise_type || 'Workout')
    .replace(/_/g, ' ')
    .toUpperCase();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Workout Record"
      className="max-w-md"
    >
      <div className="space-y-4 mt-2">
        {/* Warning card */}
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 space-y-1">
            <p className="font-semibold text-red-300">
              Are you sure you want to delete this workout?
            </p>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              This action cannot be undone. The session telemetry will be purged from your journal,
              and leaderboard ranking metrics will be recalculated.
            </p>
          </div>
        </div>

        {/* Workout summary */}
        <div className="rounded-lg bg-zinc-950/70 border border-zinc-800 p-3 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">Exercise:</span>
            <span className="font-bold text-white tracking-wide">{exerciseName}</span>
          </div>

          {isStrengthMetrics(workout.metrics) && (
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Sets / Weight:</span>
              <span className="font-bold text-amber-400 font-mono">
                {workout.metrics.sets} sets × {workout.metrics.reps} reps @ {workout.metrics.weight} kg
              </span>
            </div>
          )}

          {isCardioMetrics(workout.metrics) && (
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Distance / Duration:</span>
              <span className="font-bold text-cyan-400 font-mono">
                {workout.metrics.distance_km} km / {workout.metrics.duration_minutes} min
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1 border-t border-zinc-800/60">
            <span className="text-zinc-500 font-medium">Logged Date:</span>
            <span className="text-zinc-300 font-mono text-[11px]">
              {formatWorkoutDate(workout.date || workout.created_at)}
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
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            isLoading={isDeleting}
            className="gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Delete Workout
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteWorkoutModal;
