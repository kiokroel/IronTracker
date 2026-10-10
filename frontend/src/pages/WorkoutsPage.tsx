import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Dumbbell,
  Flame,
  Zap,
  Activity,
  AlertCircle,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Workout, isStrengthMetrics, isCardioMetrics } from '@/types/workout';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import {
  WorkoutCard,
  WorkoutFormModal,
  WorkoutFilters,
  DeleteWorkoutModal,
} from '@/components/workouts';
import { calculateOneRepMax, calculateSetTonnage, formatWeight } from '@/utils/fitness';
import { getWorkoutDateKey, formatDateGroupHeading } from '@/utils/date';

export const WorkoutsPage: React.FC = () => {
  const {
    workouts,
    isLoading,
    isDeleting,
    error,
    successMessage,
    filters,
    pagination,
    fetchWorkouts,
    deleteWorkout,
    setFilter,
    resetFilters,
    setSkip,
    clearError,
    clearSuccess,
  } = useWorkoutStore();

  const currentUser = useAuthStore((state) => state.user);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
  const [workoutToDelete, setWorkoutToDelete] = useState<Workout | null>(null);

  // Initial fetch
  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  // Auto-clear success message after 4 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        clearSuccess();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, clearSuccess]);

  // Filtered workouts list (client-side filtering + search)
  const filteredWorkouts = useMemo(() => {
    return workouts.filter((workout) => {
      // 1. My Workouts Only filter
      if (filters.onlyMyWorkouts && currentUser) {
        if (workout.user_id !== currentUser.id) return false;
      }

      // 2. Exercise type filter
      if (filters.exerciseType !== 'all') {
        const rawType = (workout.type || workout.metrics.exercise_type || '').toLowerCase();
        const exerciseName =
          'exercise_name' in workout.metrics
            ? (workout.metrics.exercise_name || '').toLowerCase()
            : '';

        if (filters.exerciseType === 'bench_press') {
          if (!rawType.includes('bench')) return false;
        } else if (filters.exerciseType === 'squats') {
          if (!rawType.includes('squat')) return false;
        } else if (filters.exerciseType === 'deadlift') {
          if (!rawType.includes('deadlift')) return false;
        } else if (filters.exerciseType === 'overhead_press') {
          if (!rawType.includes('overhead') && !exerciseName.includes('overhead')) return false;
        } else if (filters.exerciseType === 'cardio') {
          if (
            !rawType.includes('cardio') &&
            !rawType.includes('treadmill') &&
            !rawType.includes('run')
          ) {
            return false;
          }
        }
      }

      // 3. Search query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const typeMatch = (workout.type || '').toLowerCase().includes(q);
        const metricTypeMatch = (workout.metrics.exercise_type || '').toLowerCase().includes(q);
        const exerciseNameMatch =
          'exercise_name' in workout.metrics &&
          (workout.metrics.exercise_name || '').toLowerCase().includes(q);
        const styleMatch =
          'deadlift_style' in workout.metrics &&
          (workout.metrics.deadlift_style || '').toLowerCase().includes(q);
        const stanceMatch =
          'stance' in workout.metrics &&
          (workout.metrics.stance || '').toLowerCase().includes(q);

        if (!typeMatch && !metricTypeMatch && !exerciseNameMatch && !styleMatch && !stanceMatch) {
          return false;
        }
      }

      // 4. Date range filter
      const workoutDate = new Date(workout.date || workout.created_at);
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        if (workoutDate < start) return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (workoutDate > end) return false;
      }

      return true;
    });
  }, [workouts, filters, currentUser]);

  // Overall athlete statistics from loaded workouts
  const stats = useMemo(() => {
    let totalTonnage = 0;
    let heaviest1RM = 0;
    let heaviestExercise = '';
    let totalCardioKm = 0;

    for (const w of workouts) {
      if (isStrengthMetrics(w.metrics)) {
        totalTonnage += calculateSetTonnage(w.metrics.weight, w.metrics.sets, w.metrics.reps);
        const e1rm = calculateOneRepMax(w.metrics.weight, w.metrics.reps);
        if (e1rm > heaviest1RM) {
          heaviest1RM = e1rm;
          heaviestExercise = (w.type || w.metrics.exercise_type).replace(/_/g, ' ');
        }
      } else if (isCardioMetrics(w.metrics)) {
        totalCardioKm += w.metrics.distance_km;
      }
    }

    return {
      totalWorkouts: workouts.length,
      totalTonnage,
      heaviest1RM,
      heaviestExercise,
      totalCardioKm: Math.round(totalCardioKm * 10) / 10,
    };
  }, [workouts]);

  // Group workouts by Date (sorted chronological descending)
  const groupedWorkouts = useMemo(() => {
    const sorted = [...filteredWorkouts].sort((a, b) => {
      const dateA = new Date(a.date || a.created_at).getTime();
      const dateB = new Date(b.date || b.created_at).getTime();
      return dateB - dateA;
    });

    const groups: { [dateKey: string]: Workout[] } = {};
    for (const w of sorted) {
      const key = getWorkoutDateKey(w.date || w.created_at);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(w);
    }

    return Object.entries(groups).map(([dateKey, items]) => {
      // Calculate day tonnage
      const dayTonnage = items.reduce((sum, item) => {
        if (isStrengthMetrics(item.metrics)) {
          return sum + calculateSetTonnage(item.metrics.weight, item.metrics.sets, item.metrics.reps);
        }
        return sum;
      }, 0);

      return {
        dateKey,
        heading: formatDateGroupHeading(dateKey),
        items,
        dayTonnage,
      };
    });
  }, [filteredWorkouts]);

  // Handlers
  const handleOpenCreateModal = () => {
    setWorkoutToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (workout: Workout) => {
    setWorkoutToEdit(workout);
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = (workout: Workout) => {
    setWorkoutToDelete(workout);
  };

  const handleConfirmDelete = async () => {
    if (!workoutToDelete) return;
    try {
      await deleteWorkout(workoutToDelete.id);
      setWorkoutToDelete(null);
    } catch {
      // Handled by store
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast notifications */}
      {successMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={clearSuccess}
            className="p-1 text-emerald-400 hover:text-emerald-200 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="p-1 text-red-400 hover:text-red-200 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Workouts Journal</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Log telemetry, build multi-set volume, and analyze personal performance records
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} variant="primary" size="md" className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          <span>Log Workout</span>
        </Button>
      </div>

      {/* Athlete Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/80 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Total Sessions
            </span>
            <Dumbbell className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="mt-2 text-xl font-black text-white font-mono">
            {stats.totalWorkouts}
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/80 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Total Tonnage
            </span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 text-xl font-black text-red-400 font-mono">
            {formatWeight(stats.totalTonnage)}
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/80 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Heaviest 1RM
            </span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-black text-amber-400 font-mono">
            {stats.heaviest1RM > 0 ? `${stats.heaviest1RM} kg` : '—'}
          </div>
          {stats.heaviestExercise && (
            <span className="text-[10px] text-zinc-500 capitalize truncate block">
              {stats.heaviestExercise}
            </span>
          )}
        </div>

        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/80 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Cardio Distance
            </span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-xl font-black text-cyan-400 font-mono">
            {stats.totalCardioKm > 0 ? `${stats.totalCardioKm} km` : '—'}
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <WorkoutFilters
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
        totalCount={filteredWorkouts.length}
      />

      {/* Main Content Area */}
      {isLoading ? (
        <Loader text="Loading workout journal records..." />
      ) : filteredWorkouts.length === 0 ? (
        <Card className="border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Dumbbell className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white">No workouts found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
            {workouts.length === 0
              ? 'Your workout diary is currently empty. Start logging sets to begin tracking progression and tonnage!'
              : 'No workouts matched your active filter criteria. Try adjusting your search term or date range.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {workouts.length > 0 && (
              <Button onClick={resetFilters} variant="secondary" size="sm">
                Reset Filters
              </Button>
            )}
            <Button onClick={handleOpenCreateModal} variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              <span>Record Workout</span>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedWorkouts.map((group) => (
            <section key={group.dateKey} className="space-y-3">
              {/* Date Group Heading Banner */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    {group.heading}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                    {group.items.length} {group.items.length === 1 ? 'session' : 'sessions'}
                  </span>
                </div>

                {group.dayTonnage > 0 && (
                  <div className="text-xs font-medium text-zinc-400 flex items-center gap-1 font-mono">
                    <Flame className="w-3.5 h-3.5 text-red-500" />
                    <span>{formatWeight(group.dayTonnage)}</span>
                  </div>
                )}
              </div>

              {/* Workouts Grid for this date */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.items.map((workout) => (
                  <WorkoutCard
                    key={workout.id}
                    workout={workout}
                    onEdit={handleOpenEditModal}
                    onDelete={handleOpenDeleteModal}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80 text-xs text-zinc-400">
            <div>
              Showing <span className="text-white font-semibold">{filteredWorkouts.length}</span> records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.skip === 0 || isLoading}
                onClick={() => {
                  const newSkip = Math.max(0, pagination.skip - pagination.limit);
                  setSkip(newSkip);
                  fetchWorkouts();
                }}
                className="gap-1 px-3 py-1.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!pagination.hasMore || isLoading}
                onClick={() => {
                  const newSkip = pagination.skip + pagination.limit;
                  setSkip(newSkip);
                  fetchWorkouts();
                }}
                className="gap-1 px-3 py-1.5"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Workout Modal */}
      <WorkoutFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setWorkoutToEdit(null);
        }}
        workoutToEdit={workoutToEdit}
      />

      {/* Delete Confirmation Modal */}
      <DeleteWorkoutModal
        isOpen={Boolean(workoutToDelete)}
        onClose={() => setWorkoutToDelete(null)}
        workout={workoutToDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default WorkoutsPage;
