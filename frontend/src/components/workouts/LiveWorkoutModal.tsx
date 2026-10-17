import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  Zap,
  Dumbbell,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  Copy,
  AlertCircle,
  X,
  Trophy,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useLiveWorkoutStore } from '@/store/useLiveWorkoutStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { Exercise } from '@/types/exercise';
import { exercisesApi } from '@/api/exercises';
import { RestPresetSeconds } from '@/types/liveWorkout';
import { SessionExerciseType } from '@/types/workoutSession';
import {
  formatTimerDuration,
  formatRestTimerDisplay,
  calculateRestElapsedSeconds,
} from '@/utils/liveWorkout';
import { calculateOneRepMax, formatWeight } from '@/utils/fitness';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

interface LiveWorkoutModalProps {
  userId: string;
  onSuccess?: () => void;
}

export const LiveWorkoutModal: React.FC<LiveWorkoutModalProps> = ({
  userId,
  onSuccess,
}) => {
  const {
    draft,
    isLiveModalOpen,
    isFinishing,
    finishError,
    celebrationSummary,
    closeLiveModal,
    updateTitle,
    addExercise,
    removeExercise,
    setActiveExerciseIndex,
    logSet,
    duplicateLastSet,
    removeSet,
    setRestPreset,
    startRestTimer,
    resetRestTimer,
    pauseRestTimer,
    finishSession,
    clearCelebration,
  } = useLiveWorkoutStore();

  const { t, locale } = useLocaleStore();

  // Active inputs for next set
  const [inputWeight, setInputWeight] = useState<string>('100');
  const [inputReps, setInputReps] = useState<string>('5');
  const [inputRpe, setInputRpe] = useState<string>('8');
  const [isWarmup, setIsWarmup] = useState<boolean>(false);

  // Exercise selection modal state
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [catalogExercises, setCatalogExercises] = useState<Exercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const customExerciseType: SessionExerciseType = 'strength';

  // Confirmation dialogs
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);

  // Timer tick state for re-render
  const [nowMs, setNowMs] = useState(Date.now());

  // Available catalog fetch
  useEffect(() => {
    if (isAddExerciseModalOpen) {
      exercisesApi
        .getExercises()
        .then(setCatalogExercises)
        .catch(() => {});
    }
  }, [isAddExerciseModalOpen]);

  // Global ticker every 1 second
  useEffect(() => {
    if (!isLiveModalOpen) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isLiveModalOpen]);

  // Active exercise & default values
  const activeExerciseIndex = draft?.activeExerciseIndex ?? 0;
  const activeExercise = draft?.exercises[activeExerciseIndex];

  // Auto-populate inputs when switching exercises or completing a set
  useEffect(() => {
    if (!activeExercise) return;
    if (activeExercise.sets.length > 0) {
      const lastSet = activeExercise.sets[activeExercise.sets.length - 1];
      setInputWeight(String(lastSet.weight));
      setInputReps(String(lastSet.reps));
      setInputRpe(lastSet.rpe != null ? String(lastSet.rpe) : '');
      setIsWarmup(false);
    } else {
      setInputWeight('100');
      setInputReps('5');
      setInputRpe('8');
      setIsWarmup(false);
    }
  }, [activeExerciseIndex, activeExercise?.sets.length]);

  // Calculations
  const sessionElapsedSeconds = useMemo(() => {
    if (!draft?.startedAt) return 0;
    const start = new Date(draft.startedAt).getTime();
    return Math.max(0, Math.floor((nowMs - start) / 1000));
  }, [draft?.startedAt, nowMs]);

  const restElapsedSeconds = useMemo(() => {
    if (!draft) return 0;
    return calculateRestElapsedSeconds(draft);
  }, [draft, nowMs]);

  const restDisplay = useMemo(() => {
    if (!draft) return { label: '00:00', isOverdue: false, status: '' };
    const localeCode = locale === 'ru' ? 'ru' : 'en';
    const elapsedLabel = formatRestTimerDisplay(restElapsedSeconds, localeCode);

    if (draft.restTargetSeconds != null) {
      const remaining = draft.restTargetSeconds - restElapsedSeconds;
      if (remaining <= 0) {
        return {
          label: `${elapsedLabel} (+${formatRestTimerDisplay(Math.abs(remaining), localeCode)})`,
          isOverdue: true,
          status: t('liveWorkout.restTimerReady'),
        };
      }
      return {
        label: formatRestTimerDisplay(remaining, localeCode),
        isOverdue: false,
        status: t('liveWorkout.restTimerCounting'),
      };
    }

    return {
      label: elapsedLabel,
      isOverdue: false,
      status: t('liveWorkout.restPresetFree'),
    };
  }, [draft, restElapsedSeconds, locale, t]);

  if (!isLiveModalOpen) {
    return null;
  }

  // Celebration Screen
  if (celebrationSummary) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-zinc-900/95 p-6 shadow-2xl text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
            <Trophy className="h-10 w-10 animate-bounce" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {t('liveWorkout.congratsTitle')}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {t('liveWorkout.congratsSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 text-left">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                {t('liveWorkout.totalTonnage')}
              </span>
              <div className="mt-1 text-xl font-black font-mono text-red-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-red-500 shrink-0" />
                <span>{formatWeight(celebrationSummary.totalTonnage)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 text-left">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                {t('liveWorkout.workingSets')}
              </span>
              <div className="mt-1 text-xl font-black font-mono text-amber-400 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{celebrationSummary.totalWorkingSetsCount} / {celebrationSummary.totalSetsCount}</span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 text-left">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                {t('liveWorkout.exercisesCompleted')}
              </span>
              <div className="mt-1 text-xl font-black font-mono text-white flex items-center gap-1.5">
                <Dumbbell className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>{celebrationSummary.totalExercisesCount}</span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 text-left">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                {t('liveWorkout.sessionDuration')}
              </span>
              <div className="mt-1 text-xl font-black font-mono text-cyan-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-500 shrink-0" />
                <span>{celebrationSummary.durationMinutes} {t('common.min')}</span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => {
              clearCelebration();
              if (onSuccess) onSuccess();
            }}
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black tracking-wide border-0 py-3 text-base shadow-xl gap-2"
          >
            <span>{t('liveWorkout.closeSummary')}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!draft) {
    return null;
  }

  // Handle logging next set
  const handleLogCurrentSet = () => {
    const w = parseFloat(inputWeight) || 0;
    const r = parseInt(inputReps, 10) || 1;
    const rpeVal = inputRpe ? parseFloat(inputRpe) : null;

    logSet({
      weight: w,
      reps: r,
      rpe: rpeVal,
      is_warmup: isWarmup,
    });
  };

  // Handle Finish
  const handleConfirmFinish = async () => {
    setIsFinishConfirmOpen(false);
    const ok = await finishSession(userId);
    if (ok && onSuccess) {
      onSuccess();
    }
  };

  const currentSetNumber = (activeExercise?.sets.length || 0) + 1;
  const lastSet = activeExercise && activeExercise.sets.length > 0
    ? activeExercise.sets[activeExercise.sets.length - 1]
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/95 backdrop-blur-lg flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-900/90 px-4 py-3 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Workout Title & Time */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-500/40 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              {t('liveWorkout.liveBadge')}
            </span>

            <input
              type="text"
              value={draft.title}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder={t('liveWorkout.workoutTitlePlaceholder')}
              className="bg-transparent text-sm sm:text-base font-black text-white hover:bg-zinc-800/60 focus:bg-zinc-800/90 px-2 py-1 rounded border border-transparent focus:border-zinc-700 outline-none truncate max-w-[200px] sm:max-w-xs transition-colors"
            />

            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 shrink-0">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {formatTimerDuration(sessionElapsedSeconds)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={closeLiveModal}
              className="text-zinc-400 hover:text-white border-zinc-700"
              title={t('liveWorkout.minimize')}
            >
              <X className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">{t('liveWorkout.minimize')}</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsFinishConfirmOpen(true)}
              isLoading={isFinishing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-wide border-0 shadow-lg shadow-emerald-950/40"
            >
              <Check className="w-4 h-4 mr-1" />
              <span>{t('liveWorkout.finishWorkout')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Error notification if saving failed */}
        {finishError && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs shadow-lg animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{finishError}</span>
          </div>
        )}

        {/* Rest Timer Panel */}
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl border text-lg font-black font-mono transition-all',
                  restDisplay.isOverdue
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                    : draft.isRestRunning
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                )}
              >
                <Clock className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {t('liveWorkout.restTimerTitle')}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded-full',
                      restDisplay.isOverdue
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : draft.isRestRunning
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-zinc-800 text-zinc-400'
                    )}
                  >
                    {restDisplay.status}
                  </span>
                </div>

                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-0.5">
                  {restDisplay.label}
                </div>
              </div>
            </div>

            {/* Presets and Controls */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {([60, 90, 120, 180, null] as RestPresetSeconds[]).map((preset) => {
                const isSelected = draft.restTargetSeconds === preset;
                const label =
                  preset === 60
                    ? t('liveWorkout.restPreset60')
                    : preset === 90
                    ? t('liveWorkout.restPreset90')
                    : preset === 120
                    ? t('liveWorkout.restPreset120')
                    : preset === 180
                    ? t('liveWorkout.restPreset180')
                    : t('liveWorkout.restPresetFree');

                return (
                  <button
                    key={String(preset)}
                    type="button"
                    onClick={() => setRestPreset(preset)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg font-mono font-bold transition-all border',
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    )}
                  >
                    {label}
                  </button>
                );
              })}

              <div className="flex items-center gap-1 ml-1 pl-2 border-l border-zinc-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={draft.isRestRunning ? pauseRestTimer : startRestTimer}
                  className="p-1.5 h-8 w-8 text-zinc-300 hover:text-white"
                  title={draft.isRestRunning ? t('liveWorkout.pauseTimer') : t('liveWorkout.startTimer')}
                >
                  {draft.isRestRunning ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={resetRestTimer}
                  className="p-1.5 h-8 w-8 text-zinc-400 hover:text-amber-400"
                  title={t('liveWorkout.resetTimer')}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Exercises Horizontal Navigation Tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            {draft.exercises.map((ex, idx) => {
              const isActive = idx === activeExerciseIndex;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setActiveExerciseIndex(idx)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border',
                    isActive
                      ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-md shadow-amber-950/20'
                      : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-md font-mono text-[10px] font-bold',
                      isActive ? 'bg-zinc-950 text-amber-400' : 'bg-zinc-800 text-zinc-300'
                    )}
                  >
                    #{idx + 1}
                  </span>
                  <span className="truncate max-w-[120px] sm:max-w-xs">{ex.exercise_name}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded font-mono text-[10px]',
                      isActive ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                    )}
                  >
                    {ex.sets.length}
                  </span>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsAddExerciseModalOpen(true)}
            className="gap-1.5 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10 shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('liveWorkout.addExercise')}</span>
          </Button>
        </div>

        {/* Active Exercise Working Card */}
        {activeExercise && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6 space-y-6">
            {/* Exercise Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-bold text-sm">
                  #{activeExerciseIndex + 1}
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">
                    {activeExercise.exercise_name}
                  </h2>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
                    {activeExercise.exercise_type}
                  </span>
                </div>
              </div>

              {draft.exercises.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExercise(activeExerciseIndex)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800/60 transition-colors"
                  title={t('liveWorkout.removeExercise')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Logged Sets History Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {t('liveWorkout.previousSets')} ({activeExercise.sets.length})
              </span>

              {activeExercise.sets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center text-xs text-zinc-500">
                  {t('liveWorkout.noSetsYet')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeExercise.sets.map((set, sIdx) => {
                    const e1rm = calculateOneRepMax(set.weight, set.reps);
                    const vol = set.weight * set.reps;
                    return (
                      <div
                        key={set.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl border transition-all text-sm',
                          set.is_warmup
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-zinc-950/80 border-zinc-800/80 text-white'
                        )}
                      >
                        <div className="flex items-center gap-3 font-mono">
                          <span
                            className={cn(
                              'inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold border',
                              set.is_warmup
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                            )}
                          >
                            #{set.set_number}
                          </span>

                          <span className="font-bold text-base">
                            {set.weight} {t('common.kg')}
                          </span>
                          <span className="text-zinc-500">×</span>
                          <span className="font-bold text-base">
                            {set.reps} {t('common.reps')}
                          </span>

                          {set.rpe != null && (
                            <span className="text-xs text-zinc-400 ml-2">
                              @{set.rpe} RPE
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 font-mono text-xs">
                          {e1rm > 0 && !set.is_warmup && (
                            <span className="hidden sm:inline text-amber-400/90 font-semibold">
                              1RM: {e1rm} kg
                            </span>
                          )}

                          {vol > 0 && (
                            <span className={cn(set.is_warmup ? 'line-through text-zinc-500' : 'text-zinc-400')}>
                              {vol} kg
                            </span>
                          )}

                          {set.is_warmup && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                              {t('liveWorkout.warmupBadge')}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => removeSet(activeExerciseIndex, sIdx)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors ml-1"
                            title={t('liveWorkout.deleteSet')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fast Next Set Logging Form (Mobile-first, Big Tap Targets) */}
            <div className="rounded-2xl border-2 border-amber-500/40 bg-zinc-950/90 p-4 sm:p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-zinc-950 font-mono text-xs font-black">
                    #{currentSetNumber}
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {t('liveWorkout.nextSet', { number: String(currentSetNumber) })}
                  </h3>
                </div>

                {lastSet && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={duplicateLastSet}
                    className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 gap-1.5 text-xs font-bold self-start sm:self-auto"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {t('liveWorkout.duplicateLastSet', {
                        number: String(lastSet.set_number),
                        weight: String(lastSet.weight),
                        reps: String(lastSet.reps),
                      })}
                    </span>
                  </Button>
                )}
              </div>

              {/* Input Steppers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Weight Input & Steppers */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    {t('liveWorkout.weight')}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInputWeight((prev) =>
                          String(Math.max(0, (parseFloat(prev) || 0) - 2.5))
                        )
                      }
                      className="h-10 w-10 shrink-0 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-lg flex items-center justify-center transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={inputWeight}
                      onChange={(e) => setInputWeight(e.target.value)}
                      className="w-full h-10 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-center font-mono text-xl font-black text-white focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setInputWeight((prev) =>
                          String((parseFloat(prev) || 0) + 2.5)
                        )
                      }
                      className="h-10 w-10 shrink-0 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-lg flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Reps Input & Steppers */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 space-y-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    {t('liveWorkout.reps')}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInputReps((prev) =>
                          String(Math.max(1, (parseInt(prev, 10) || 1) - 1))
                        )
                      }
                      className="h-10 w-10 shrink-0 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-lg flex items-center justify-center transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={inputReps}
                      onChange={(e) => setInputReps(e.target.value)}
                      className="w-full h-10 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-center font-mono text-xl font-black text-white focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setInputReps((prev) =>
                          String((parseInt(prev, 10) || 0) + 1)
                        )
                      }
                      className="h-10 w-10 shrink-0 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-lg flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* RPE & Warmup Switch */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      {t('liveWorkout.rpe')}
                    </label>
                    <div className="flex items-center gap-1">
                      {['7', '8', '9', '10'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setInputRpe(val)}
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors',
                            inputRpe === val
                              ? 'bg-amber-500 text-zinc-950'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Warmup Interactive Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsWarmup(!isWarmup)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-all',
                      isWarmup
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Flame className={cn('w-4 h-4', isWarmup ? 'text-amber-400 fill-amber-400/30' : 'text-zinc-500')} />
                      <span>{t('liveWorkout.warmup')}</span>
                    </span>
                    <span className="text-[10px] font-mono">
                      {isWarmup ? 'EXCLUDED' : 'TONNAGE'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Big Prominent Action Button: Log Set */}
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleLogCurrentSet}
                className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black uppercase tracking-wider text-base py-3.5 shadow-xl shadow-amber-950/40 gap-2"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>{t('liveWorkout.logSet')}</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Exercise Modal */}
      <Modal
        isOpen={isAddExerciseModalOpen}
        onClose={() => setIsAddExerciseModalOpen(false)}
        title={t('liveWorkout.selectExerciseTitle')}
      >
        <div className="space-y-4">
          <Input
            placeholder={t('liveWorkout.searchExercisePlaceholder')}
            value={exerciseSearch}
            onChange={(e) => setExerciseSearch(e.target.value)}
          />

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {catalogExercises
              .filter((ex) =>
                ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
              )
              .map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    const detectedType: SessionExerciseType =
                      ex.category === 'cardio'
                        ? 'cardio'
                        : ex.category === 'bodyweight'
                        ? 'bodyweight'
                        : 'strength';
                    addExercise({
                      id: ex.id,
                      name: ex.name,
                      type: detectedType,
                    });
                    setIsAddExerciseModalOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 hover:border-amber-500/40 text-left transition-all"
                >
                  <span className="text-sm font-bold text-white truncate">
                    {ex.is_custom ? `⭐ ${ex.name}` : ex.name}
                  </span>
                  <span className="text-xs uppercase font-mono text-zinc-500">
                    {ex.category}
                  </span>
                </button>
              ))}
          </div>

          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <span className="text-xs font-semibold text-zinc-400">
              {t('exercises.addCustomShort')}
            </span>
            <div className="flex gap-2">
              <Input
                placeholder={t('liveWorkout.customExerciseNamePlaceholder')}
                value={customExerciseName}
                onChange={(e) => setCustomExerciseName(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!customExerciseName.trim()}
                onClick={() => {
                  if (!customExerciseName.trim()) return;
                  addExercise({
                    name: customExerciseName.trim(),
                    type: customExerciseType,
                  });
                  setCustomExerciseName('');
                  setIsAddExerciseModalOpen(false);
                }}
                className="shrink-0"
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Finish Workout Confirmation Modal */}
      <Modal
        isOpen={isFinishConfirmOpen}
        onClose={() => setIsFinishConfirmOpen(false)}
        title={t('liveWorkout.finishConfirmTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            {activeExercise?.sets.length === 0
              ? t('liveWorkout.finishConfirmNoSetsDesc')
              : t('liveWorkout.finishConfirmDesc')}
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsFinishConfirmOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={isFinishing}
              onClick={handleConfirmFinish}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {t('liveWorkout.finishWorkout')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LiveWorkoutModal;
