import React, { useState } from 'react';
import { Play, Trash2, Activity, Clock, Dumbbell, AlertTriangle } from 'lucide-react';
import { useLiveWorkoutStore } from '@/store/useLiveWorkoutStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatWorkoutTime } from '@/utils/date';

interface LiveWorkoutBannerProps {
  userId: string;
}

export const LiveWorkoutBanner: React.FC<LiveWorkoutBannerProps> = ({ userId }) => {
  const { draft, resumeWorkout, discardWorkout } = useLiveWorkoutStore();
  const { t } = useLocaleStore();
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);

  if (!draft || draft.userId !== userId) {
    return null;
  }

  const totalSets = draft.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalExercises = draft.exercises.length;
  const startTimeStr = formatWorkoutTime(draft.startedAt) || draft.startedAt.slice(11, 16);

  const handleConfirmDiscard = () => {
    discardWorkout(userId);
    setIsDiscardModalOpen(false);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
        {/* Glow effect */}
        <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start sm:items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Activity className="h-5 w-5 animate-pulse text-amber-400" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/30">
                  {t('liveWorkout.liveBadge')}
                </span>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {t('liveWorkout.draftDetectedTitle')}
                </h3>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  {startTimeStr}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Dumbbell className="w-3.5 h-3.5 text-zinc-500" />
                  {totalExercises} {t('workouts.exercises').toLowerCase()}
                </span>
                <span>•</span>
                <span>
                  {totalSets} {t('common.sets')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsDiscardModalOpen(true)}
              className="border-zinc-700 hover:border-red-500/40 hover:bg-red-500/10 text-zinc-400 hover:text-red-300 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('liveWorkout.discardDraft')}</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={resumeWorkout}
              className="bg-amber-600 hover:bg-amber-500 text-black font-black tracking-wide border-0 gap-1.5 shadow-lg shadow-amber-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>{t('liveWorkout.resumeDraft')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      <Modal
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
        title={t('liveWorkout.discardConfirmTitle')}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-300 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <p className="leading-relaxed">{t('liveWorkout.discardConfirmDesc')}</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsDiscardModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleConfirmDiscard}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('liveWorkout.discardDraft')}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
