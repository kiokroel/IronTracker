import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Copy, Flame, Zap, Dumbbell, Activity } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  Workout,
  WorkoutCreate,
  WorkoutUpdate,
  WorkoutMetrics,
  WorkoutSetRow,
  StrengthSet,
  isStrengthMetrics,
  isCardioMetrics,
} from '@/types/workout';
import { Exercise } from '@/types/exercise';
import { exercisesApi } from '@/api/exercises';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CustomExerciseModal } from './CustomExerciseModal';
import { calculateOneRepMax, calculateDetailedSetsTonnage, formatWeight } from '@/utils/fitness';
import { toLocalDatetimeInputValue, toUtcIsoString } from '@/utils/date';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { useLocaleStore } from '@/store/useLocaleStore';

export interface WorkoutFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutToEdit?: Workout | null;
  onSuccess?: () => void;
}

export const WorkoutFormModal: React.FC<WorkoutFormModalProps> = ({
  isOpen,
  onClose,
  workoutToEdit,
  onSuccess,
}) => {
  const { createWorkout, updateWorkout, isSubmitting } = useWorkoutStore();
  const { t } = useLocaleStore();

  const isEditMode = Boolean(workoutToEdit);

  // Exercise library & custom modal
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Form state
  const [movement, setMovement] = useState<string>('bench_press');
  const [datetimeLocal, setDatetimeLocal] = useState<string>(toLocalDatetimeInputValue());
  const [formError, setFormError] = useState<string | null>(null);

  // Strength dynamic sets
  const [sets, setSets] = useState<WorkoutSetRow[]>([
    { id: '1', setNumber: 1, weight: 100, reps: 5, rpe: 8 },
    { id: '2', setNumber: 2, weight: 100, reps: 5, rpe: 8 },
    { id: '3', setNumber: 3, weight: 100, reps: 5, rpe: 8.5 },
  ]);

  // Movement-specific options
  const [gripWidth, setGripWidth] = useState<string>('');
  const [stance, setStance] = useState<'narrow' | 'medium' | 'wide'>('medium');
  const [deadliftStyle, setDeadliftStyle] = useState<'conventional' | 'sumo'>('conventional');

  // Cardio state
  const [distanceKm, setDistanceKm] = useState<string>('5');
  const [durationMinutes, setDurationMinutes] = useState<string>('25');
  const [heartRate, setHeartRate] = useState<string>('');
  const [caloriesBurned, setCaloriesBurned] = useState<string>('');

  // Fetch exercises on open
  useEffect(() => {
    if (isOpen) {
      exercisesApi.getExercises().then(setAvailableExercises).catch(() => {});
    }
  }, [isOpen]);


  // Populate form on edit / open
  useEffect(() => {
    if (workoutToEdit && isOpen) {
      setDatetimeLocal(toLocalDatetimeInputValue(workoutToEdit.date || workoutToEdit.created_at));

      const raw = (workoutToEdit.type || workoutToEdit.metrics.exercise_type || '').toLowerCase();
      if (raw.includes('bench')) {
        setMovement('bench_press');
      } else if (raw.includes('squat')) {
        setMovement('squats');
      } else if (raw.includes('deadlift')) {
        setMovement('deadlift');
      } else if (raw.includes('overhead') || ('exercise_name' in workoutToEdit.metrics && workoutToEdit.metrics.exercise_name?.includes('overhead'))) {
        setMovement('overhead_press');
      } else {
        setMovement('cardio');
      }

      if (isStrengthMetrics(workoutToEdit.metrics)) {
        const sm = workoutToEdit.metrics;
        if (sm.detailed_sets && sm.detailed_sets.length > 0) {
          const loadedSets: WorkoutSetRow[] = sm.detailed_sets.map((ds, idx) => ({
            id: String(idx + 1),
            setNumber: ds.set_number || idx + 1,
            weight: ds.weight,
            reps: ds.reps,
            rpe: ds.rpe,
            is_warmup: Boolean(ds.is_warmup),
          }));
          setSets(loadedSets);
        } else {
          const totalSets = sm.sets || 1;
          const generatedSets: WorkoutSetRow[] = [];
          for (let i = 1; i <= totalSets; i++) {
            generatedSets.push({
              id: String(i),
              setNumber: i,
              weight: sm.weight,
              reps: sm.reps,
              rpe: sm.rpe,
              is_warmup: false,
            });
          }
          setSets(generatedSets);
        }

        if ('grip_width_cm' in sm && sm.grip_width_cm) {
          setGripWidth(String(sm.grip_width_cm));
        }
        if ('stance' in sm && sm.stance) {
          setStance(sm.stance);
        }
        if ('deadlift_style' in sm && sm.deadlift_style) {
          setDeadliftStyle(sm.deadlift_style);
        }
      } else if (isCardioMetrics(workoutToEdit.metrics)) {
        const cm = workoutToEdit.metrics;
        setDistanceKm(String(cm.distance_km));
        setDurationMinutes(String(cm.duration_minutes));
        if (cm.heart_rate) setHeartRate(String(cm.heart_rate));
        if (cm.calories_burned) setCaloriesBurned(String(cm.calories_burned));
      }
    } else if (!workoutToEdit && isOpen) {
      // Reset to defaults for creation
      setDatetimeLocal(toLocalDatetimeInputValue());
      setMovement('bench_press');
      setSets([
        { id: '1', setNumber: 1, weight: 60, reps: 10, rpe: 6, is_warmup: true },
        { id: '2', setNumber: 2, weight: 100, reps: 5, rpe: 8, is_warmup: false },
        { id: '3', setNumber: 3, weight: 100, reps: 5, rpe: 8.5, is_warmup: false },
      ]);
      setGripWidth('');
      setStance('medium');
      setDeadliftStyle('conventional');
      setDistanceKm('5');
      setDurationMinutes('25');
      setHeartRate('');
      setCaloriesBurned('');
      setFormError(null);
    }
  }, [workoutToEdit, isOpen]);

  // Dynamic set builder functions
  const handleAddSet = () => {
    const lastSet = sets[sets.length - 1];
    const newSet: WorkoutSetRow = {
      id: String(Date.now()),
      setNumber: sets.length + 1,
      weight: lastSet ? lastSet.weight : 100,
      reps: lastSet ? lastSet.reps : 5,
      rpe: lastSet ? lastSet.rpe : undefined,
      is_warmup: false,
    };
    setSets([...sets, newSet]);
  };

  const handleDuplicateSet = (index: number) => {
    const target = sets[index];
    const newSet: WorkoutSetRow = {
      id: String(Date.now()),
      setNumber: sets.length + 1,
      weight: target.weight,
      reps: target.reps,
      rpe: target.rpe,
      is_warmup: Boolean(target.is_warmup),
    };
    const updated = [...sets.slice(0, index + 1), newSet, ...sets.slice(index + 1)].map(
      (s, idx) => ({ ...s, setNumber: idx + 1 })
    );
    setSets(updated);
  };

  const handleToggleWarmup = (id: string) => {
    setSets(
      sets.map((s) => (s.id === id ? { ...s, is_warmup: !s.is_warmup } : s))
    );
  };

  const handleRemoveSet = (id: string) => {
    if (sets.length <= 1) return;
    const filtered = sets
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
    setSets(filtered);
  };

  const handleUpdateSet = (
    id: string,
    field: 'weight' | 'reps' | 'rpe',
    value: string
  ) => {
    setSets(
      sets.map((s) => {
        if (s.id !== id) return s;
        if (field === 'weight') {
          return { ...s, weight: Math.max(0, parseFloat(value) || 0) };
        }
        if (field === 'reps') {
          return { ...s, reps: Math.max(0, parseInt(value, 10) || 0) };
        }
        if (field === 'rpe') {
          const num = value ? parseFloat(value) : undefined;
          return { ...s, rpe: num };
        }
        return s;
      })
    );
  };

  // Real-time calculations
  const totalTonnage = useMemo(() => {
    return calculateDetailedSetsTonnage(sets);
  }, [sets]);

  const workingSets = useMemo(() => {
    return sets.filter((s) => !s.is_warmup);
  }, [sets]);

  const candidateSets = useMemo(() => {
    return workingSets.length > 0 ? workingSets : sets;
  }, [workingSets, sets]);

  const heaviestSet = useMemo<WorkoutSetRow>(() => {
    if (candidateSets.length === 0) return { id: '0', setNumber: 0, weight: 0, reps: 0 };
    return candidateSets.reduce((prev, curr) => (curr.weight > prev.weight ? curr : prev), candidateSets[0]);
  }, [candidateSets]);

  const best1RMSet = useMemo<WorkoutSetRow | null>(() => {
    if (candidateSets.length === 0) return null;
    return candidateSets.reduce((best, curr) => {
      const bestMax = calculateOneRepMax(best.weight, best.reps);
      const currMax = calculateOneRepMax(curr.weight, curr.reps);
      return currMax > bestMax ? curr : best;
    }, candidateSets[0]);
  }, [candidateSets]);

  const estimated1RM = useMemo(() => {
    if (!best1RMSet) return 0;
    return calculateOneRepMax(best1RMSet.weight, best1RMSet.reps);
  }, [best1RMSet]);

  const totalReps = useMemo(() => {
    return sets.reduce((sum, s) => sum + s.reps, 0);
  }, [sets]);

  // Cardio real-time pace
  const cardioPace = useMemo(() => {
    const dist = parseFloat(distanceKm);
    const dur = parseFloat(durationMinutes);
    if (dist > 0 && dur > 0) {
      return (dur / dist).toFixed(2);
    }
    return null;
  }, [distanceKm, durationMinutes]);

  // Selected exercise lookup and cardio detection
  const selectedExercise = useMemo(() => {
    return availableExercises.find(
      (e) => e.name.toLowerCase() === movement.toLowerCase() || e.id === movement
    );
  }, [availableExercises, movement]);

  const isCardio = useMemo(() => {
    if (movement === 'cardio') return true;
    if (selectedExercise) {
      return selectedExercise.category === 'cardio';
    }
    return false;
  }, [movement, selectedExercise]);

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      const isoDate = toUtcIsoString(datetimeLocal);

      let metricsPayload: WorkoutMetrics;
      let workoutType = movement;

      if (!isCardio) {
        // Validate sets
        if (sets.length === 0) {
          throw new Error(t('workouts.validationAddSet'));
        }
        for (const s of sets) {
          if (s.weight <= 0) {
            throw new Error(t('workouts.validationWeight', { set: s.setNumber }));
          }
          if (s.reps <= 0) {
            throw new Error(t('workouts.validationReps', { set: s.setNumber }));
          }
          if (s.rpe !== undefined && (s.rpe < 1 || s.rpe > 10)) {
            throw new Error(t('workouts.validationRpe', { set: s.setNumber }));
          }
        }

        const detailedSetsPayload: StrengthSet[] = sets.map((s, idx) => ({
          set_number: idx + 1,
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
          is_warmup: Boolean(s.is_warmup),
        }));

        const maxWeight = heaviestSet.weight;
        const totalSetsCount = sets.length;
        const primaryReps = heaviestSet.reps;
        const primaryRpe = heaviestSet.rpe;

        if (movement === 'bench_press') {
          workoutType = 'bench_press';
          metricsPayload = {
            exercise_type: 'bench_press',
            weight: maxWeight,
            sets: totalSetsCount,
            reps: primaryReps,
            rpe: primaryRpe,
            detailed_sets: detailedSetsPayload,
            grip_width_cm: gripWidth ? parseFloat(gripWidth) : undefined,
          };
        } else if (movement === 'squats') {
          workoutType = 'squats';
          metricsPayload = {
            exercise_type: 'squats',
            weight: maxWeight,
            sets: totalSetsCount,
            reps: primaryReps,
            rpe: primaryRpe,
            detailed_sets: detailedSetsPayload,
            stance: stance,
          };
        } else if (movement === 'deadlift') {
          workoutType = 'deadlift';
          metricsPayload = {
            exercise_type: 'deadlift',
            weight: maxWeight,
            sets: totalSetsCount,
            reps: primaryReps,
            rpe: primaryRpe,
            detailed_sets: detailedSetsPayload,
            deadlift_style: deadliftStyle,
          };
        } else if (movement === 'overhead_press') {
          workoutType = 'overhead_press';
          metricsPayload = {
            exercise_type: 'strength',
            exercise_name: 'overhead_press',
            weight: maxWeight,
            sets: totalSetsCount,
            reps: primaryReps,
            rpe: primaryRpe,
            detailed_sets: detailedSetsPayload,
          };
        } else {
          // Custom or additional library strength exercise
          const exName = selectedExercise ? selectedExercise.name : movement;
          workoutType = 'strength';
          metricsPayload = {
            exercise_type: 'strength',
            exercise_name: exName,
            weight: maxWeight,
            sets: totalSetsCount,
            reps: primaryReps,
            rpe: primaryRpe,
            detailed_sets: detailedSetsPayload,
          };
        }
      } else {
        // Cardio validation
        const dist = parseFloat(distanceKm);
        const dur = parseFloat(durationMinutes);
        if (isNaN(dist) || dist <= 0) {
          throw new Error(t('workouts.validationDistance'));
        }
        if (isNaN(dur) || dur <= 0) {
          throw new Error(t('workouts.validationDuration'));
        }

        const exName = selectedExercise ? selectedExercise.name : 'Cardio Run';
        workoutType = 'cardio';
        metricsPayload = {
          exercise_type: 'cardio',
          exercise_name: exName,
          distance_km: dist,
          duration_minutes: dur,
          heart_rate: heartRate ? parseInt(heartRate, 10) : undefined,
          calories_burned: caloriesBurned ? parseInt(caloriesBurned, 10) : undefined,
        };
      }


      if (isEditMode && workoutToEdit) {
        const updatePayload: WorkoutUpdate = {
          type: workoutType,
          date: isoDate,
          metrics: metricsPayload,
        };
        await updateWorkout(workoutToEdit.id, updatePayload);
      } else {
        const createPayload: WorkoutCreate = {
          type: workoutType,
          date: isoDate,
          metrics: metricsPayload,
        };
        await createWorkout(createPayload);
      }

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError(t('workouts.processError'));
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? t('workouts.editWorkout') : t('workouts.newWorkout')}
      description={
        isEditMode
          ? t('workouts.modifyTelemetryDesc')
          : t('workouts.configureSetsDesc')
      }
      className="max-w-3xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-6 pt-2">
        {formError && (
          <div className="p-3.5 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl">
            {formError}
          </div>
        )}

        {/* Workout Metadata Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {t('workouts.activityMovement')}
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('exercises.addCustomShort')}
                </button>
              </div>
              <select
                value={movement}
                onChange={(e) => setMovement(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
              >
                <optgroup label={t('exercises.systemBadge')}>
                  <option value="bench_press">{t('workouts.bench_press')}</option>
                  <option value="squats">{t('workouts.squats')}</option>
                  <option value="deadlift">{t('workouts.deadlift')}</option>
                  <option value="overhead_press">{t('workouts.overhead_press')}</option>
                  <option value="cardio">{t('workouts.cardioTreadmill')}</option>
                  {availableExercises
                    .filter(
                      (ex) =>
                        !ex.is_custom &&
                        ![
                          'bench_press',
                          'squats',
                          'deadlift',
                          'overhead_press',
                          'cardio',
                          'жим штанги лежа',
                          'приседания со штангой',
                          'становая тяга',
                          'армейский жим стоя',
                          'беговая дорожка',
                        ].includes(ex.name.toLowerCase())
                    )
                    .map((ex) => (
                      <option key={ex.id} value={ex.name}>
                        {ex.name}
                      </option>
                    ))}
                </optgroup>
                {availableExercises.some((ex) => ex.is_custom) && (
                  <optgroup label={t('exercises.customBadge')}>
                    {availableExercises
                      .filter((ex) => ex.is_custom)
                      .map((ex) => (
                        <option key={ex.id} value={ex.name}>
                          ⭐ {ex.name}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <Input
                label={t('workouts.workoutTimestamp')}
                type="datetime-local"
                value={datetimeLocal}
                onChange={(e) => setDatetimeLocal(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Exercise Card & Sets Section */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
          {/* Header with pill switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs font-bold">
                <Dumbbell className="w-4 h-4" />
              </span>
              <div>
                <span className="text-sm font-bold text-white block">
                  {selectedExercise
                    ? selectedExercise.name
                    : movement === 'bench_press'
                    ? t('workouts.bench_press')
                    : movement === 'squats'
                    ? t('workouts.squats')
                    : movement === 'deadlift'
                    ? t('workouts.deadlift')
                    : movement === 'overhead_press'
                    ? t('workouts.overhead_press')
                    : movement === 'cardio'
                    ? t('workouts.cardioTreadmill')
                    : movement}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {!isCardio ? t('workouts.strengthTelemetry') : t('workouts.cardioTelemetry')}
                </span>
              </div>
            </div>

            {/* Type Switcher */}
            <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  if (isCardio) {
                    setMovement('bench_press');
                  }
                }}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
                  !isCardio
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                {t('workouts.typeStrength')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isCardio) {
                    setMovement('cardio');
                  }
                }}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
                  isCardio
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                {t('workouts.typeCardio')}
              </button>
            </div>
          </div>

          {/* STRENGTH CONSTRUCTOR */}
          {!isCardio ? (
            <div className="space-y-4">
              {/* Dynamic Sets Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    {t('workouts.setsConstructor')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddSet}
                    className="text-xs py-1 h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-amber-400" />
                    {t('workouts.addSet')}
                  </Button>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 divide-y divide-zinc-800/60 overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-900/60">
                    <div className="col-span-1 text-center">{t('workouts.setCol')}</div>
                    <div className="col-span-3 text-center">{t('workouts.weightCol')}</div>
                    <div className="col-span-2 text-center">{t('workouts.repsCol')}</div>
                    <div className="col-span-2 text-center">{t('workouts.rpeCol')}</div>
                    <div className="col-span-3 text-center">{t('workouts.setTypeCol')}</div>
                    <div className="col-span-1 text-right">{t('workouts.actionsCol')}</div>
                  </div>

                  {/* Sets Rows */}
                  {sets.map((set, idx) => {
                    const setWeight = set.weight || 0;
                    const setReps = set.reps || 0;
                    const set1RM = setWeight > 0 && setReps > 0 ? calculateOneRepMax(setWeight, setReps) : 0;
                    const setVolume = setWeight * setReps;

                    return (
                      <div
                        key={set.id}
                        className={cn(
                          'grid grid-cols-12 gap-2 items-center px-3 py-2.5 text-sm transition-all',
                          set.is_warmup ? 'bg-amber-500/10' : 'hover:bg-zinc-900/30'
                        )}
                      >
                        {/* Set Number */}
                        <div className="col-span-1 text-center font-bold font-mono text-zinc-300 text-xs">
                          <span
                            className={cn(
                              'inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-mono font-bold border',
                              set.is_warmup
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                            )}
                          >
                            #{set.setNumber}
                          </span>
                        </div>

                        {/* Weight */}
                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={set.weight}
                            onChange={(e) => handleUpdateSet(set.id, 'weight', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-white font-mono text-center focus:border-amber-500 focus:outline-none"
                            required
                          />
                          {set1RM > 0 && (
                            <span className="text-[10px] text-amber-400/90 font-mono block text-center mt-0.5">
                              1RM: {set1RM} {t('common.kg')}
                            </span>
                          )}
                        </div>

                        {/* Reps */}
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={set.reps}
                            onChange={(e) => handleUpdateSet(set.id, 'reps', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-white font-mono text-center focus:border-amber-500 focus:outline-none"
                            required
                          />
                          {setVolume > 0 && (
                            <span
                              className={cn(
                                'text-[10px] font-mono block text-center mt-0.5',
                                set.is_warmup ? 'text-zinc-500 line-through' : 'text-zinc-400'
                              )}
                            >
                              {setVolume} {t('common.kg')}
                            </span>
                          )}
                        </div>

                        {/* RPE */}
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="10"
                            placeholder={t('workouts.rpeOptPlaceholder')}
                            value={set.rpe ?? ''}
                            onChange={(e) => handleUpdateSet(set.id, 'rpe', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-white font-mono text-center focus:border-amber-500 focus:outline-none placeholder-zinc-600"
                          />
                        </div>

                        {/* Warmup Interactive Toggle Badge */}
                        <div className="col-span-3 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleToggleWarmup(set.id)}
                            className={cn(
                              'w-full flex flex-col items-center justify-center py-1.5 px-2 rounded-lg border transition-all cursor-pointer select-none',
                              set.is_warmup
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 shadow-sm shadow-amber-500/10'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                            )}
                            title={set.is_warmup ? t('workouts.warmup') : t('workouts.workingSet')}
                          >
                            <span className="flex items-center gap-1 font-bold text-xs">
                              {set.is_warmup ? (
                                <>
                                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
                                  <span>{t('workouts.warmup')}</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3.5 h-3.5 text-zinc-500" />
                                  <span>{t('workouts.workingSet')}</span>
                                </>
                              )}
                            </span>
                            <span
                              className={cn(
                                'text-[9px] font-mono tracking-tight leading-none mt-0.5',
                                set.is_warmup ? 'text-amber-400/80' : 'text-zinc-500'
                              )}
                            >
                              {set.is_warmup ? t('workouts.warmupExcludedShort') : '+ тоннаж'}
                            </span>
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="col-span-1 flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateSet(idx)}
                            className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                            title={t('workouts.duplicateSet')}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={sets.length <= 1}
                            onClick={() => handleRemoveSet(set.id)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                            title={t('workouts.removeSet')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Movement-specific customization options */}
              {['bench_press', 'squats', 'deadlift', 'overhead_press'].includes(movement) && (
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 space-y-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                    {t('workouts.movementSpecifics')}
                  </span>

                  {movement === 'bench_press' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label={t('workouts.gripWidthLabel')}
                        type="number"
                        step="1"
                        min="10"
                        max="120"
                        placeholder={t('workouts.gripWidthPlaceholder')}
                        value={gripWidth}
                        onChange={(e) => setGripWidth(e.target.value)}
                        helperText={t('workouts.gripWidthHelper')}
                      />
                    </div>
                  )}

                  {movement === 'squats' && (
                    <div className="space-y-1.5 max-w-xs">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                        {t('workouts.stanceWidthLabel')}
                      </label>
                      <select
                        value={stance}
                        onChange={(e) => setStance(e.target.value as 'narrow' | 'medium' | 'wide')}
                        className="w-full px-3.5 py-2 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:outline-none"
                      >
                        <option value="narrow">{t('workouts.stanceNarrow')}</option>
                        <option value="medium">{t('workouts.stanceMedium')}</option>
                        <option value="wide">{t('workouts.stanceWide')}</option>
                      </select>
                    </div>
                  )}

                  {movement === 'deadlift' && (
                    <div className="space-y-1.5 max-w-xs">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                        {t('workouts.deadliftStyleLabel')}
                      </label>
                      <select
                        value={deadliftStyle}
                        onChange={(e) => setDeadliftStyle(e.target.value as 'conventional' | 'sumo')}
                        className="w-full px-3.5 py-2 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:outline-none"
                      >
                        <option value="conventional">{t('workouts.deadliftConventional')}</option>
                        <option value="sumo">{t('workouts.deadliftSumo')}</option>
                      </select>
                    </div>
                  )}

                  {movement === 'overhead_press' && (
                    <p className="text-xs text-zinc-400">
                      {t('workouts.overheadPressDesc')}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* CARDIO FORM */
            <div className="space-y-4">
              {/* Real-time pace widget */}
              <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 p-3.5 flex items-center justify-between text-xs">
                <span className="text-zinc-400">{t('workouts.calculatedAvgPace')}</span>
                <span className="font-bold text-cyan-400 font-mono text-sm">
                  {cardioPace ? `${cardioPace} ${t('workouts.paceUnit')}` : '—'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('workouts.distanceInputLabel')}
                  type="number"
                  step="0.01"
                  min="0.1"
                  placeholder="5.0"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  required
                />
                <Input
                  label={t('workouts.durationInputLabel')}
                  type="number"
                  step="0.5"
                  min="1"
                  placeholder="25"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('workouts.heartRateInputLabel')}
                  type="number"
                  min="40"
                  max="240"
                  placeholder="150"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  helperText={t('workouts.heartRateHelper')}
                />
                <Input
                  label={t('workouts.caloriesBurnedLabel')}
                  type="number"
                  min="1"
                  placeholder="320"
                  value={caloriesBurned}
                  onChange={(e) => setCaloriesBurned(e.target.value)}
                  helperText={t('workouts.caloriesHelper')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Telemetry Summary Strip */}
        {!isCardio && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-zinc-500">
                  {t('workouts.tonnage')}
                </div>
                <div className="text-sm font-black font-mono text-white">
                  {formatWeight(totalTonnage)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-zinc-500">
                  {t('workouts.heaviest1RM')}
                </div>
                <div className="text-sm font-black font-mono text-white">
                  {estimated1RM} {t('common.kg')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Dumbbell className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-zinc-500">
                  {t('workouts.totalSets')}
                </div>
                <div className="text-sm font-black font-mono text-white">
                  {workingSets.length}
                  {sets.length !== workingSets.length && (
                    <span className="text-xs font-normal text-amber-400 ml-1">
                      (+{sets.length - workingSets.length} {t('workouts.warmupCount')})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-zinc-500">
                  {t('workouts.totalReps')}
                </div>
                <div className="text-sm font-black font-mono text-white">
                  {totalReps}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end items-center gap-3 pt-3 border-t border-zinc-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isEditMode ? t('workouts.saveChanges') : t('workouts.recordWorkout')}
          </Button>
        </div>
      </form>

      {/* Custom Exercise Creation Modal */}
      <CustomExerciseModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onCreated={(created) => {
          setAvailableExercises((prev) => [...prev, created]);
          setMovement(created.name);
        }}
      />
    </Modal>
  );
};

export default WorkoutFormModal;

