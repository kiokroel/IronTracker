import React, { useState } from 'react';
import { Plus, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Exercise,
  ExerciseCategory,
  ExerciseCreate,
  MuscleGroup,
  EquipmentType,
} from '@/types/exercise';
import { exercisesApi } from '@/api/exercises';
import { useLocaleStore } from '@/store/useLocaleStore';

export interface CustomExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
];

const CATEGORIES: ExerciseCategory[] = ['strength', 'cardio', 'bodyweight'];

const EQUIPMENT_OPTIONS: EquipmentType[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'other',
];

export const CustomExerciseModal: React.FC<CustomExerciseModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { t } = useLocaleStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('strength');
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>(['chest']);
  const [equipment, setEquipment] = useState<EquipmentType>('barbell');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMuscleGroup = (mg: MuscleGroup) => {
    if (selectedMuscles.includes(mg)) {
      if (selectedMuscles.length > 1) {
        setSelectedMuscles(selectedMuscles.filter((m) => m !== mg));
      }
    } else {
      setSelectedMuscles([...selectedMuscles, mg]);
    }
  };

  const getCategoryLabel = (cat: ExerciseCategory): string => {
    switch (cat) {
      case 'strength':
        return t('exercises.categoryStrength');
      case 'cardio':
        return t('exercises.categoryCardio');
      case 'bodyweight':
        return t('exercises.categoryBodyweight');
    }
  };

  const getMuscleLabel = (mg: MuscleGroup): string => {
    switch (mg) {
      case 'chest':
        return t('exercises.muscleChest');
      case 'back':
        return t('exercises.muscleBack');
      case 'legs':
        return t('exercises.muscleLegs');
      case 'shoulders':
        return t('exercises.muscleShoulders');
      case 'arms':
        return t('exercises.muscleArms');
      case 'core':
        return t('exercises.muscleCore');
      case 'full_body':
        return t('exercises.muscleFullBody');
    }
  };

  const getEquipmentLabel = (eq: EquipmentType): string => {
    switch (eq) {
      case 'barbell':
        return t('exercises.equipBarbell');
      case 'dumbbell':
        return t('exercises.equipDumbbell');
      case 'machine':
        return t('exercises.equipMachine');
      case 'cable':
        return t('exercises.equipCable');
      case 'bodyweight':
        return t('exercises.equipBodyweight');
      case 'other':
        return t('exercises.equipOther');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t('exercises.validationNameMin'));
      return;
    }
    if (selectedMuscles.length === 0) {
      setError(t('exercises.validationMusclesRequired'));
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: ExerciseCreate = {
        name: trimmed,
        category,
        target_muscle_groups: selectedMuscles,
        equipment,
      };
      const created = await exercisesApi.createCustomExercise(payload);
      onCreated(created);
      onClose();
      // Reset form
      setName('');
      setCategory('strength');
      setSelectedMuscles(['chest']);
      setEquipment('barbell');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      const detailMsg = axiosErr?.response?.data?.detail;
      setError(detailMsg || (err instanceof Error ? err.message : 'Error creating exercise'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('exercises.createModalTitle')}
      description={t('exercises.createModalDesc')}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
            {t('exercises.nameLabel')} <span className="text-red-400">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('exercises.namePlaceholder')}
            required
            autoFocus
          />
        </div>

        {/* Category selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
            {t('exercises.categoryLabel')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                  category === cat
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Target muscle groups (Multi-select) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
            {t('exercises.targetMusclesLabel')}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map((mg) => {
              const isSelected = selectedMuscles.includes(mg);
              return (
                <button
                  key={mg}
                  type="button"
                  onClick={() => toggleMuscleGroup(mg)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  {getMuscleLabel(mg)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Equipment */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
            {t('exercises.equipmentLabel')}
          </label>
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as EquipmentType)}
            className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
          >
            {EQUIPMENT_OPTIONS.map((eq) => (
              <option key={eq} value={eq}>
                {getEquipmentLabel(eq)}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {t('exercises.addCustom')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CustomExerciseModal;
