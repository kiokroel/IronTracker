import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Copy, Flame, Zap } from 'lucide-react';
import {
  Workout,
  WorkoutCreate,
  WorkoutUpdate,
  WorkoutMetrics,
  WorkoutSetRow,
  isStrengthMetrics,
  isCardioMetrics,
} from '@/types/workout';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { calculateOneRepMax, formatWeight } from '@/utils/fitness';
import { toLocalDatetimeInputValue, toUtcIsoString } from '@/utils/date';
import { useWorkoutStore } from '@/store/useWorkoutStore';

export interface WorkoutFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutToEdit?: Workout | null;
  onSuccess?: () => void;
}

type MovementType = 'bench_press' | 'squats' | 'deadlift' | 'overhead_press' | 'cardio';

export const WorkoutFormModal: React.FC<WorkoutFormModalProps> = ({
  isOpen,
  onClose,
  workoutToEdit,
  onSuccess,
}) => {
  const { createWorkout, updateWorkout, isSubmitting } = useWorkoutStore();

  const isEditMode = Boolean(workoutToEdit);

  // Form state
  const [movement, setMovement] = useState<MovementType>('bench_press');
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
        const totalSets = sm.sets || 1;
        const generatedSets: WorkoutSetRow[] = [];
        for (let i = 1; i <= totalSets; i++) {
          generatedSets.push({
            id: String(i),
            setNumber: i,
            weight: sm.weight,
            reps: sm.reps,
            rpe: sm.rpe,
          });
        }
        setSets(generatedSets);

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
        { id: '1', setNumber: 1, weight: 100, reps: 5, rpe: 8 },
        { id: '2', setNumber: 2, weight: 100, reps: 5, rpe: 8 },
        { id: '3', setNumber: 3, weight: 100, reps: 5, rpe: 8.5 },
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
    };
    const updated = [...sets.slice(0, index + 1), newSet, ...sets.slice(index + 1)].map(
      (s, idx) => ({ ...s, setNumber: idx + 1 })
    );
    setSets(updated);
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
    return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  }, [sets]);

  const heaviestSet = useMemo<WorkoutSetRow>(() => {
    if (sets.length === 0) return { id: '0', setNumber: 0, weight: 0, reps: 0 };
    return sets.reduce((prev, curr) => (curr.weight > prev.weight ? curr : prev), sets[0]);
  }, [sets]);

  const estimated1RM = useMemo(() => {
    return calculateOneRepMax(heaviestSet.weight, heaviestSet.reps);
  }, [heaviestSet]);

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

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      const isoDate = toUtcIsoString(datetimeLocal);

      let metricsPayload: WorkoutMetrics;
      let workoutType = movement;

      if (movement !== 'cardio') {
        // Validate sets
        if (sets.length === 0) {
          throw new Error('Please add at least one set to the workout.');
        }
        for (const s of sets) {
          if (s.weight <= 0) {
            throw new Error(`Set #${s.setNumber}: Weight must be greater than 0 kg.`);
          }
          if (s.reps <= 0) {
            throw new Error(`Set #${s.setNumber}: Repetitions must be greater than 0.`);
          }
          if (s.rpe !== undefined && (s.rpe < 1 || s.rpe > 10)) {
            throw new Error(`Set #${s.setNumber}: RPE must be between 1 and 10.`);
          }
        }

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
            deadlift_style: deadliftStyle,
          };
        } else {
          // overhead_press -> mapped to strength contract
          workoutType = 'overhead_press';
          metricsPayload = {
            exercise_type: 'strength',
            exercise_name: 'overhead_press',
            weight: maxWeight,
            sets: totalSetsCount,
            reps: primaryReps,
            rpe: primaryRpe,
          };
        }
      } else {
        // Cardio validation
        const dist = parseFloat(distanceKm);
        const dur = parseFloat(durationMinutes);
        if (isNaN(dist) || dist <= 0) {
          throw new Error('Distance must be greater than 0 km.');
        }
        if (isNaN(dur) || dur <= 0) {
          throw new Error('Duration must be greater than 0 minutes.');
        }

        workoutType = 'cardio';
        metricsPayload = {
          exercise_type: 'cardio',
          exercise_name: 'Cardio Run',
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
        setFormError('Failed to process workout session.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Workout Record' : 'Log Workout Session'}
      description={
        isEditMode
          ? 'Modify your telemetry, sets, and metrics'
          : 'Configure sets, weight, reps, and track your tonnage in real-time'
      }
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 mt-2">
        {formError && (
          <div className="p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg">
            {formError}
          </div>
        )}

        {/* Movement selection & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Activity Movement
            </label>
            <select
              value={movement}
              onChange={(e) => setMovement(e.target.value as MovementType)}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
            >
              <option value="bench_press">Bench Press</option>
              <option value="squats">Squats</option>
              <option value="deadlift">Deadlift</option>
              <option value="overhead_press">Overhead Press</option>
              <option value="cardio">Cardio / Treadmill</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Workout Timestamp
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={datetimeLocal}
                onChange={(e) => setDatetimeLocal(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>
        </div>

        {/* STRENGTH CONSTRUCTOR */}
        {movement !== 'cardio' ? (
          <div className="space-y-4">
            {/* Real-time telemetry summary banner */}
            <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider block">
                  Total Tonnage
                </span>
                <span className="text-base font-bold text-red-400 flex items-center justify-center gap-1 font-mono mt-0.5">
                  <Flame className="w-4 h-4 text-red-500" />
                  {formatWeight(totalTonnage)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider block">
                  Heaviest 1RM
                </span>
                <span className="text-base font-bold text-amber-400 flex items-center justify-center gap-1 font-mono mt-0.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  {estimated1RM} kg
                </span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider block">
                  Total Sets
                </span>
                <span className="text-base font-bold text-white font-mono mt-0.5 block">
                  {sets.length}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider block">
                  Total Reps
                </span>
                <span className="text-base font-bold text-white font-mono mt-0.5 block">
                  {totalReps}
                </span>
              </div>
            </div>

            {/* Dynamic Sets Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Sets Constructor
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSet}
                  className="text-xs py-1 h-8"
                >
                  <Plus className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  Add Set
                </Button>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 divide-y divide-zinc-800/60 overflow-hidden">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-900/60">
                  <div className="col-span-2 text-center">Set</div>
                  <div className="col-span-3">Weight (kg)</div>
                  <div className="col-span-3">Reps</div>
                  <div className="col-span-2">RPE (1-10)</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* Rows */}
                {sets.map((set, idx) => (
                  <div
                    key={set.id}
                    className="grid grid-cols-12 gap-2 items-center px-3 py-2 text-sm hover:bg-zinc-900/30 transition-colors"
                  >
                    <div className="col-span-2 text-center font-bold font-mono text-zinc-300 text-xs">
                      #{set.setNumber}
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={set.weight}
                        onChange={(e) => handleUpdateSet(set.id, 'weight', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-white font-mono focus:border-amber-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={set.reps}
                        onChange={(e) => handleUpdateSet(set.id, 'reps', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-white font-mono focus:border-amber-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="10"
                        placeholder="opt"
                        value={set.rpe ?? ''}
                        onChange={(e) => handleUpdateSet(set.id, 'rpe', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-white font-mono focus:border-amber-500 focus:outline-none placeholder-zinc-600"
                      />
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateSet(idx)}
                        className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                        title="Duplicate set"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={sets.length <= 1}
                        onClick={() => handleRemoveSet(set.id)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                        title="Remove set"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Movement-specific customization options */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Movement Specifics
              </span>

              {movement === 'bench_press' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Grip Width (cm)"
                    type="number"
                    step="1"
                    min="10"
                    max="120"
                    placeholder="e.g. 81"
                    value={gripWidth}
                    onChange={(e) => setGripWidth(e.target.value)}
                    helperText="Distance between index fingers on barbell rings"
                  />
                </div>
              )}

              {movement === 'squats' && (
                <div className="space-y-1.5 max-w-xs">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Stance Width
                  </label>
                  <select
                    value={stance}
                    onChange={(e) => setStance(e.target.value as 'narrow' | 'medium' | 'wide')}
                    className="w-full px-3.5 py-2 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="narrow">Narrow (Hip-width)</option>
                    <option value="medium">Medium (Shoulder-width)</option>
                    <option value="wide">Wide (Sumo stance)</option>
                  </select>
                </div>
              )}

              {movement === 'deadlift' && (
                <div className="space-y-1.5 max-w-xs">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Deadlift Style
                  </label>
                  <select
                    value={deadliftStyle}
                    onChange={(e) => setDeadliftStyle(e.target.value as 'conventional' | 'sumo')}
                    className="w-full px-3.5 py-2 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="conventional">Conventional</option>
                    <option value="sumo">Sumo</option>
                  </select>
                </div>
              )}

              {movement === 'overhead_press' && (
                <p className="text-xs text-zinc-400">
                  Strict military standing barbell press telemetry with core bracing.
                </p>
              )}
            </div>
          </div>
        ) : (
          /* CARDIO FORM */
          <div className="space-y-4">
            {/* Real-time pace widget */}
            <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 p-3.5 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Calculated Average Pace:</span>
              <span className="font-bold text-cyan-400 font-mono text-sm">
                {cardioPace ? `${cardioPace} min/km` : '—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Distance (km)"
                type="number"
                step="0.01"
                min="0.1"
                placeholder="5.0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                required
              />
              <Input
                label="Duration (minutes)"
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
                label="Avg Heart Rate (bpm)"
                type="number"
                min="40"
                max="240"
                placeholder="150"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                helperText="Optional cardio telemetry"
              />
              <Input
                label="Calories Burned (kcal)"
                type="number"
                min="1"
                placeholder="320"
                value={caloriesBurned}
                onChange={(e) => setCaloriesBurned(e.target.value)}
                helperText="Optional caloric expenditure"
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end items-center gap-3 pt-3 border-t border-zinc-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isEditMode ? 'Save Changes' : 'Record Workout'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default WorkoutFormModal;
