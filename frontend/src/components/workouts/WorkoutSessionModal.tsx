import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus,
  Trash2,
  Copy,
  Flame,
  Zap,
  Dumbbell,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CustomExerciseModal } from './CustomExerciseModal';
import { exercisesApi } from '@/api/exercises';
import { workoutSessionsApi } from '@/api/workoutSessions';
import {
  WorkoutSession,
  WorkoutSessionCreate,
  WorkoutSessionExerciseItem,
  SessionExerciseType,
  calculateClientSessionTonnage,
} from '@/types/workoutSession';
import { Exercise } from '@/types/exercise';
import { useLocaleStore } from '@/store/useLocaleStore';
import { toLocalDatetimeInputValue, toUtcIsoString } from '@/utils/date';
import { calculateOneRepMax } from '@/utils/fitness';

export interface WorkoutSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToEdit?: WorkoutSession | null;
  onSuccess?: () => void;
}

interface FormSetItem {
  id: string;
  set_number: number;
  weight: number | string;
  reps: number | string;
  rpe?: number | string;
  is_warmup: boolean;
}

interface FormExerciseItem {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  exercise_type: SessionExerciseType;
  sets: FormSetItem[];
  distance_km?: string;
  duration_minutes?: string;
  heart_rate?: string;
  calories_burned?: string;
  notes?: string;
}

const generateId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const createDefaultSet = (setNumber: number, prevSet?: FormSetItem): FormSetItem => ({
  id: generateId('set'),
  set_number: setNumber,
  weight: prevSet !== undefined ? prevSet.weight : 100,
  reps: prevSet !== undefined ? prevSet.reps : 5,
  rpe: prevSet?.rpe !== undefined ? prevSet.rpe : '',
  is_warmup: false,
});

const createDefaultExercise = (): FormExerciseItem => ({
  id: generateId('ex'),
  exercise_id: null,
  exercise_name: '',
  exercise_type: 'strength',
  sets: [
    {
      id: generateId('set'),
      set_number: 1,
      weight: 60,
      reps: 10,
      rpe: '',
      is_warmup: true,
    },
    {
      id: generateId('set'),
      set_number: 2,
      weight: 100,
      reps: 5,
      rpe: 8,
      is_warmup: false,
    },
  ],
  distance_km: '',
  duration_minutes: '',
  heart_rate: '',
  calories_burned: '',
  notes: '',
});

export const WorkoutSessionModal: React.FC<WorkoutSessionModalProps> = ({
  isOpen,
  onClose,
  sessionToEdit,
  onSuccess,
}) => {
  const { t } = useLocaleStore();
  const isEditMode = Boolean(sessionToEdit);

  // Available catalog exercises
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);

  // Session metadata
  const [title, setTitle] = useState('');
  const [datetimeLocal, setDatetimeLocal] = useState(toLocalDatetimeInputValue());
  const [durationMinutes, setDurationMinutes] = useState('');
  const [notes, setNotes] = useState('');

  // Exercises array
  const [exercises, setExercises] = useState<FormExerciseItem[]>([createDefaultExercise()]);

  // Loading & error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Fetch exercises catalog
  useEffect(() => {
    if (isOpen) {
      exercisesApi
        .getExercises()
        .then(setAvailableExercises)
        .catch(() => {});
    }
  }, [isOpen]);

  // Populate form on edit or reset on create
  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      if (sessionToEdit) {
        setTitle(sessionToEdit.title || '');
        setDatetimeLocal(
          toLocalDatetimeInputValue(sessionToEdit.date || sessionToEdit.created_at)
        );
        setDurationMinutes(
          sessionToEdit.duration_minutes != null ? String(sessionToEdit.duration_minutes) : ''
        );
        setNotes(sessionToEdit.notes || '');

        if (sessionToEdit.exercises && sessionToEdit.exercises.length > 0) {
          const loadedExercises: FormExerciseItem[] = sessionToEdit.exercises.map(
            (ex, exIdx) => ({
              id: generateId(`ex_edit_${exIdx}`),
              exercise_id: ex.exercise_id || null,
              exercise_name: ex.exercise_name || '',
              exercise_type: ex.exercise_type || 'strength',
              sets:
                ex.sets && ex.sets.length > 0
                  ? ex.sets.map((s, sIdx) => ({
                      id: generateId(`s_edit_${exIdx}_${sIdx}`),
                      set_number: s.set_number || sIdx + 1,
                      weight: s.weight ?? 0,
                      reps: s.reps ?? 0,
                      rpe: s.rpe != null ? s.rpe : '',
                      is_warmup: Boolean(s.is_warmup),
                    }))
                  : [
                      {
                        id: generateId('set'),
                        set_number: 1,
                        weight: 100,
                        reps: 5,
                        rpe: '',
                        is_warmup: false,
                      },
                    ],
              distance_km: ex.distance_km != null ? String(ex.distance_km) : '',
              duration_minutes:
                ex.duration_minutes != null ? String(ex.duration_minutes) : '',
              heart_rate: ex.heart_rate != null ? String(ex.heart_rate) : '',
              calories_burned:
                ex.calories_burned != null ? String(ex.calories_burned) : '',
              notes: ex.notes || '',
            })
          );
          setExercises(loadedExercises);
        } else {
          setExercises([createDefaultExercise()]);
        }
      } else {
        // Reset for new creation
        setTitle('');
        setDatetimeLocal(toLocalDatetimeInputValue());
        setDurationMinutes('');
        setNotes('');
        setExercises([createDefaultExercise()]);
      }
    }
  }, [isOpen, sessionToEdit]);

  // Exercise handlers
  const handleAddExercise = () => {
    setExercises((prev) => [...prev, createDefaultExercise()]);
  };

  const handleRemoveExercise = (exerciseId: string) => {
    if (exercises.length <= 1) return;
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  };

  const handleUpdateExercise = (
    exerciseId: string,
    patch: Partial<FormExerciseItem>
  ) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, ...patch } : e))
    );
  };

  const handleCatalogSelect = (exerciseId: string, selectedCatalogId: string) => {
    if (!selectedCatalogId) {
      handleUpdateExercise(exerciseId, { exercise_id: null });
      return;
    }
    const found = availableExercises.find((a) => a.id === selectedCatalogId);
    if (found) {
      const detectedType: SessionExerciseType =
        found.category === 'cardio'
          ? 'cardio'
          : found.category === 'bodyweight'
          ? 'bodyweight'
          : 'strength';
      handleUpdateExercise(exerciseId, {
        exercise_id: found.id,
        exercise_name: found.name,
        exercise_type: detectedType,
      });
    }
  };

  // Set handlers
  const handleAddSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet = createDefaultSet(ex.sets.length + 1, lastSet);
        return {
          ...ex,
          sets: [...ex.sets, newSet],
        };
      })
    );
  };

  const handleDuplicateSet = (exerciseId: string, setIndex: number) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const target = ex.sets[setIndex];
        const duplicated: FormSetItem = {
          id: generateId('set'),
          set_number: ex.sets.length + 1,
          weight: target.weight,
          reps: target.reps,
          rpe: target.rpe,
          is_warmup: target.is_warmup,
        };
        const updatedSets = [
          ...ex.sets.slice(0, setIndex + 1),
          duplicated,
          ...ex.sets.slice(setIndex + 1),
        ].map((s, idx) => ({ ...s, set_number: idx + 1 }));
        return {
          ...ex,
          sets: updatedSets,
        };
      })
    );
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        if (ex.sets.length <= 1) return ex;
        const filtered = ex.sets
          .filter((s) => s.id !== setId)
          .map((s, idx) => ({ ...s, set_number: idx + 1 }));
        return {
          ...ex,
          sets: filtered,
        };
      })
    );
  };

  const handleToggleWarmup = (exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) =>
            s.id === setId ? { ...s, is_warmup: !s.is_warmup } : s
          ),
        };
      })
    );
  };

  const handleUpdateSet = (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps' | 'rpe',
    value: string
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            if (field === 'weight') {
              return { ...s, weight: value };
            }
            if (field === 'reps') {
              return { ...s, reps: value };
            }
            if (field === 'rpe') {
              return { ...s, rpe: value };
            }
            return s;
          }),
        };
      })
    );
  };

  // Live session statistics
  const sessionSummary = useMemo(() => {
    const convertedItems: WorkoutSessionExerciseItem[] = exercises.map((ex) => ({
      exercise_name: ex.exercise_name,
      exercise_type: ex.exercise_type,
      sets: ex.sets.map((s) => ({
        set_number: s.set_number,
        weight: typeof s.weight === 'string' ? parseFloat(s.weight) || 0 : s.weight,
        reps: typeof s.reps === 'string' ? parseInt(String(s.reps), 10) || 0 : s.reps,
        rpe:
          s.rpe !== '' && s.rpe !== undefined
            ? typeof s.rpe === 'string'
              ? parseFloat(s.rpe) || null
              : s.rpe
            : null,
        is_warmup: Boolean(s.is_warmup),
      })),
    }));

    const totalTonnage = calculateClientSessionTonnage(convertedItems);

    let totalWorkingSets = 0;
    for (const ex of exercises) {
      if (ex.exercise_type === 'strength' || ex.exercise_type === 'bodyweight') {
        for (const s of ex.sets) {
          if (!s.is_warmup) {
            totalWorkingSets++;
          }
        }
      }
    }

    return {
      totalTonnage,
      totalWorkingSets,
      totalExercises: exercises.length,
    };
  }, [exercises]);

  // Validation
  const validateForm = (): string | null => {
    if (exercises.length === 0) {
      return t('workouts.validationAtLeastOneExercise');
    }

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const idx = i + 1;
      const name = ex.exercise_name.trim();

      if (!name) {
        return t('workouts.validationExerciseNameRequired', { idx: String(idx) });
      }

      if (ex.exercise_type === 'strength' || ex.exercise_type === 'bodyweight') {
        if (ex.sets.length === 0) {
          return t('workouts.validationExerciseSetsRequired', {
            idx: String(idx),
            name,
          });
        }

        for (let sIdx = 0; sIdx < ex.sets.length; sIdx++) {
          const s = ex.sets[sIdx];
          const setNum = String(s.set_number);
          const w = typeof s.weight === 'string' ? parseFloat(s.weight) : s.weight;
          const r = typeof s.reps === 'string' ? parseInt(String(s.reps), 10) : s.reps;

          if (isNaN(w) || w < 0) {
            return t('workouts.validationSetWeight', {
              idx: String(idx),
              set: setNum,
            });
          }
          if (isNaN(r) || r <= 0) {
            return t('workouts.validationSetReps', {
              idx: String(idx),
              set: setNum,
            });
          }
          if (s.rpe !== '' && s.rpe !== undefined && s.rpe !== null) {
            const rpeNum =
              typeof s.rpe === 'string' ? parseFloat(s.rpe) : s.rpe;
            if (isNaN(rpeNum) || rpeNum < 1 || rpeNum > 10) {
              return t('workouts.validationSetRpe', {
                idx: String(idx),
                set: setNum,
              });
            }
          }
        }
      } else if (ex.exercise_type === 'cardio') {
        const dist = parseFloat(ex.distance_km || '0');
        const dur = parseFloat(ex.duration_minutes || '0');
        if ((isNaN(dist) || dist <= 0) && (isNaN(dur) || dur <= 0)) {
          return t('workouts.validationCardioFields', {
            idx: String(idx),
            name,
          });
        }
      }
    }

    return null;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);

      const payloadExercises: WorkoutSessionExerciseItem[] = exercises.map(
        (ex) => ({
          exercise_id: ex.exercise_id || null,
          exercise_name: ex.exercise_name.trim(),
          exercise_type: ex.exercise_type,
          sets:
            ex.exercise_type === 'strength' || ex.exercise_type === 'bodyweight'
              ? ex.sets.map((s, idx) => ({
                  set_number: idx + 1,
                  weight:
                    typeof s.weight === 'string'
                      ? parseFloat(s.weight) || 0
                      : s.weight,
                  reps:
                    typeof s.reps === 'string'
                      ? parseInt(String(s.reps), 10) || 0
                      : s.reps,
                  rpe:
                    s.rpe !== '' && s.rpe !== undefined && s.rpe !== null
                      ? typeof s.rpe === 'string'
                        ? parseFloat(s.rpe) || null
                        : s.rpe
                      : null,
                  is_warmup: Boolean(s.is_warmup),
                }))
              : [],
          distance_km:
            ex.exercise_type === 'cardio' && ex.distance_km
              ? parseFloat(ex.distance_km) || null
              : null,
          duration_minutes:
            ex.exercise_type === 'cardio' && ex.duration_minutes
              ? parseFloat(ex.duration_minutes) || null
              : null,
          heart_rate:
            ex.exercise_type === 'cardio' && ex.heart_rate
              ? parseInt(ex.heart_rate, 10) || null
              : null,
          calories_burned:
            ex.exercise_type === 'cardio' && ex.calories_burned
              ? parseInt(ex.calories_burned, 10) || null
              : null,
          notes: ex.notes ? ex.notes.trim() : null,
        })
      );

      const sessionPayload: WorkoutSessionCreate = {
        title: title.trim() || null,
        date: toUtcIsoString(datetimeLocal),
        duration_minutes: durationMinutes
          ? parseInt(durationMinutes, 10) || null
          : null,
        notes: notes.trim() || null,
        exercises: payloadExercises,
      };

      if (isEditMode && sessionToEdit) {
        await workoutSessionsApi.updateWorkoutSession(
          sessionToEdit.id,
          sessionPayload
        );
      } else {
        await workoutSessionsApi.createWorkoutSession(sessionPayload);
      }

      setIsSubmitting(false);
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') {
          setFormError(detail);
        } else if (Array.isArray(detail)) {
          setFormError(
            detail
              .map(
                (d: { msg?: string; loc?: (string | number)[] }) =>
                  d.msg || JSON.stringify(d)
              )
              .join('; ')
          );
        } else {
          setFormError(err.message || t('workouts.processError'));
        }
      } else if (err instanceof Error) {
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
      title={isEditMode ? t('workouts.editTitle') : t('workouts.sessionModalTitle')}
      description={t('workouts.sessionModalDesc')}
      className="max-w-4xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-6 pt-2">
        {/* Error notification */}
        {formError && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs shadow-lg animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{formError}</span>
          </div>
        )}

        {/* Session Metadata Grid */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Input
                label={t('workouts.sessionTitleLabel')}
                placeholder={t('workouts.sessionTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
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
            <div>
              <Input
                label={t('workouts.sessionDurationLabel')}
                type="number"
                min="1"
                placeholder={t('workouts.sessionDurationPlaceholder')}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Input
              label={t('workouts.sessionNotesLabel')}
              placeholder={t('workouts.sessionNotesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Exercises Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {t('workouts.sessionExercises')}
              </h3>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddExercise}
              className="gap-1.5 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('workouts.addExercise')}</span>
            </Button>
          </div>

          {/* Dynamic exercise cards list */}
          <div className="space-y-4">
            {exercises.map((ex, exIdx) => (
              <div
                key={ex.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4"
              >
                {/* Exercise card header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs font-bold">
                      {exIdx + 1}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {ex.exercise_name ||
                        `${t('workouts.exerciseLabel')} #${exIdx + 1}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Exercise Type Pill Switcher */}
                    <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateExercise(ex.id, { exercise_type: 'strength' })
                        }
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
                          ex.exercise_type === 'strength'
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : 'text-zinc-400 hover:text-white'
                        )}
                      >
                        {t('workouts.typeStrength')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateExercise(ex.id, { exercise_type: 'bodyweight' })
                        }
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
                          ex.exercise_type === 'bodyweight'
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : 'text-zinc-400 hover:text-white'
                        )}
                      >
                        {t('workouts.typeBodyweight')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateExercise(ex.id, { exercise_type: 'cardio' })
                        }
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
                          ex.exercise_type === 'cardio'
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : 'text-zinc-400 hover:text-white'
                        )}
                      >
                        {t('workouts.typeCardio')}
                      </button>
                    </div>

                    {/* Delete Exercise Button */}
                    <button
                      type="button"
                      disabled={exercises.length <= 1}
                      onClick={() => handleRemoveExercise(ex.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                      title={t('workouts.removeExercise')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Exercise selection and name inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                        {t('workouts.exerciseCatalogSelect')}
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
                      value={ex.exercise_id || ''}
                      onChange={(e) => handleCatalogSelect(ex.id, e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-colors"
                    >
                      <option value="">
                        {t('workouts.selectExercisePlaceholder')}
                      </option>
                      {availableExercises.map((ae) => (
                        <option key={ae.id} value={ae.id}>
                          {ae.is_custom ? `⭐ ${ae.name}` : ae.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label={t('workouts.customExerciseName')}
                    placeholder={t('workouts.customExerciseNamePlaceholder')}
                    value={ex.exercise_name}
                    onChange={(e) =>
                      handleUpdateExercise(ex.id, { exercise_name: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Sub-form: Strength / Bodyweight Sets Table */}
                {(ex.exercise_type === 'strength' ||
                  ex.exercise_type === 'bodyweight') && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        {t('workouts.strengthTelemetry')}
                      </span>
                    </div>

                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1.5 bg-zinc-950/60 rounded-lg border border-zinc-800/80">
                      <div className="col-span-1 text-center">
                        {t('workouts.setCol')}
                      </div>
                      <div className="col-span-3 text-center">
                        {t('workouts.weightCol')}
                      </div>
                      <div className="col-span-2 text-center">
                        {t('workouts.repsCol')}
                      </div>
                      <div className="col-span-2 text-center">
                        {t('workouts.rpeCol')}
                      </div>
                      <div className="col-span-3 text-center">
                        {t('workouts.setTypeCol')}
                      </div>
                      <div className="col-span-1 text-right">
                        {t('workouts.actionsCol')}
                      </div>
                    </div>

                    {/* Sets Rows */}
                    <div className="space-y-1.5">
                      {ex.sets.map((set, setIdx) => {
                        const numWeight = typeof set.weight === 'string' ? parseFloat(set.weight) || 0 : set.weight || 0;
                        const numReps = typeof set.reps === 'string' ? parseInt(String(set.reps), 10) || 0 : set.reps || 0;
                        const set1RM = numWeight > 0 && numReps > 0 ? calculateOneRepMax(numWeight, numReps) : 0;
                        const setVolume = numWeight * numReps;

                        return (
                          <div
                            key={set.id}
                            className={cn(
                              'grid grid-cols-12 gap-2 items-center p-2 rounded-lg border transition-all',
                              set.is_warmup
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700'
                            )}
                          >
                            {/* Set number */}
                            <div className="col-span-1 text-center font-mono font-bold text-xs text-zinc-400">
                              <span
                                className={cn(
                                  'inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-mono font-bold border',
                                  set.is_warmup
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                                )}
                              >
                                #{set.set_number}
                              </span>
                            </div>

                            {/* Weight */}
                            <div className="col-span-3">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={set.weight}
                                onChange={(e) =>
                                  handleUpdateSet(
                                    ex.id,
                                    set.id,
                                    'weight',
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-center font-mono text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
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
                                step="1"
                                min="1"
                                value={set.reps}
                                onChange={(e) =>
                                  handleUpdateSet(
                                    ex.id,
                                    set.id,
                                    'reps',
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-center font-mono text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
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
                                onChange={(e) =>
                                  handleUpdateSet(
                                    ex.id,
                                    set.id,
                                    'rpe',
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-center font-mono text-sm text-zinc-100 focus:border-amber-500 focus:outline-none placeholder:text-zinc-600"
                              />
                            </div>

                            {/* Warmup Interactive Toggle Badge */}
                            <div className="col-span-3 flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => handleToggleWarmup(ex.id, set.id)}
                                className={cn(
                                  'w-full flex flex-col items-center justify-center py-1 px-2 rounded-lg border transition-all cursor-pointer select-none',
                                  set.is_warmup
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 shadow-sm shadow-amber-500/10'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
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
                                onClick={() => handleDuplicateSet(ex.id, setIdx)}
                                className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                                title={t('workouts.duplicateSet')}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={ex.sets.length <= 1}
                                onClick={() => handleRemoveSet(ex.id, set.id)}
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

                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAddSet(ex.id)}
                        className="gap-1.5 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('workouts.addSet')}</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sub-form: Cardio Fields */}
                {ex.exercise_type === 'cardio' && (
                  <div className="space-y-3 pt-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                      {t('workouts.cardioTelemetry')}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Input
                        label={t('workouts.exerciseDistance')}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="5.0"
                        value={ex.distance_km || ''}
                        onChange={(e) =>
                          handleUpdateExercise(ex.id, {
                            distance_km: e.target.value,
                          })
                        }
                      />
                      <Input
                        label={t('workouts.exerciseDuration')}
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="30"
                        value={ex.duration_minutes || ''}
                        onChange={(e) =>
                          handleUpdateExercise(ex.id, {
                            duration_minutes: e.target.value,
                          })
                        }
                      />
                      <Input
                        label={t('workouts.exerciseHeartRate')}
                        type="number"
                        min="40"
                        max="240"
                        placeholder="145"
                        value={ex.heart_rate || ''}
                        onChange={(e) =>
                          handleUpdateExercise(ex.id, {
                            heart_rate: e.target.value,
                          })
                        }
                      />
                      <Input
                        label={t('workouts.exerciseCalories')}
                        type="number"
                        min="1"
                        placeholder="300"
                        value={ex.calories_burned || ''}
                        onChange={(e) =>
                          handleUpdateExercise(ex.id, {
                            calories_burned: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Optional Exercise Notes */}
                <div>
                  <Input
                    label={t('workouts.exerciseNotes')}
                    placeholder="e.g. drop set, pause reps, tempo..."
                    value={ex.notes || ''}
                    onChange={(e) =>
                      handleUpdateExercise(ex.id, { notes: e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Session Tonnage & Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-500">
                {t('workouts.sessionTotalTonnage')}
              </div>
              <div className="text-sm font-black font-mono text-white">
                {sessionSummary.totalTonnage.toLocaleString()} kg
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-500">
                {t('workouts.sessionWorkingSets')}
              </div>
              <div className="text-sm font-black font-mono text-white">
                {sessionSummary.totalWorkingSets}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-500">
                {t('workouts.sessionTotalExercises')}
              </div>
              <div className="text-sm font-black font-mono text-white">
                {sessionSummary.totalExercises}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end items-center gap-3 pt-3 border-t border-zinc-800">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            className="gap-2"
          >
            {isSubmitting
              ? t('workouts.savingSession')
              : t('workouts.saveSession')}
          </Button>
        </div>
      </form>

      {/* Custom Exercise Creation Modal */}
      <CustomExerciseModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onCreated={(created) => {
          setAvailableExercises((prev) => [...prev, created]);
        }}
      />
    </Modal>
  );
};

export default WorkoutSessionModal;
