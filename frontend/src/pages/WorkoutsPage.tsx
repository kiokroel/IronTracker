import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  Layers,
  Radio,
} from 'lucide-react';
import { Workout, isStrengthMetrics, isCardioMetrics } from '@/types/workout';
import { WorkoutSession } from '@/types/workoutSession';
import { workoutSessionsApi } from '@/api/workoutSessions';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Loader } from '@/components/ui/Loader';
import {
  WorkoutCard,
  WorkoutFormModal,
  WorkoutFilters,
  DeleteWorkoutModal,
  CustomExerciseModal,
  WorkoutSessionModal,
  WorkoutSessionCard,
  LiveWorkoutBanner,
  LiveWorkoutModal,
} from '@/components/workouts';
import { useLiveWorkoutStore } from '@/store/useLiveWorkoutStore';
import {
  calculateOneRepMax,
  calculateSetTonnage,
  calculateDetailedSetsTonnage,
  formatWeight,
} from '@/utils/fitness';
import { getWorkoutDateKey, formatDateGroupHeading } from '@/utils/date';
import { formatExerciseName } from '@/utils/exercise';

export type FeedItem =
  | { kind: 'single'; id: string; date: string; data: Workout }
  | { kind: 'session'; id: string; date: string; data: WorkoutSession };

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
  const { t, locale } = useLocaleStore();

  // Sessions state
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<WorkoutSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<WorkoutSession | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isCustomExerciseModalOpen, setIsCustomExerciseModalOpen] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
  const [workoutToDelete, setWorkoutToDelete] = useState<Workout | null>(null);

  // Fetch workout sessions
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoadingSessions(true);
      const data = await workoutSessionsApi.getWorkoutSessions({
        user_id: currentUser?.id,
        limit: 100,
      });
      setSessions(data);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingSessions(false);
    }
  }, [currentUser?.id]);

  // Initial fetch
  useEffect(() => {
    fetchWorkouts();
    fetchSessions();
  }, [fetchWorkouts, fetchSessions]);

  // Live workout store & draft detection
  const {
    draft: liveDraft,
    checkDraft: checkLiveDraft,
    startNewWorkout: startNewLiveWorkout,
    resumeWorkout: resumeLiveWorkout,
  } = useLiveWorkoutStore();

  useEffect(() => {
    if (currentUser?.id) {
      checkLiveDraft(currentUser.id);
    }
  }, [currentUser?.id, checkLiveDraft]);

  const handleStartLiveWorkout = () => {
    if (!currentUser?.id) return;
    if (liveDraft && liveDraft.userId === currentUser.id) {
      resumeLiveWorkout();
    } else {
      startNewLiveWorkout(currentUser.id, t('liveWorkout.workoutTitleDefault'));
    }
  };

  // Auto-clear success message after 4 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        clearSuccess();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, clearSuccess]);

  // Filtered Single Workouts
  const filteredSingleWorkouts = useMemo(() => {
    return workouts.filter((workout) => {
      // 1. User isolation
      if (currentUser && workout.user_id !== currentUser.id) {
        return false;
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

  // Filtered Complex Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // 1. User isolation
      if (currentUser && session.user_id !== currentUser.id) {
        return false;
      }

      // 2. Exercise type filter
      if (filters.exerciseType !== 'all') {
        const hasMatchingExercise = session.exercises.some((ex) => {
          const raw = (ex.exercise_name || '').toLowerCase();
          const exType = (ex.exercise_type || '').toLowerCase();
          if (filters.exerciseType === 'bench_press') return raw.includes('bench') || raw.includes('жим');
          if (filters.exerciseType === 'squats') return raw.includes('squat') || raw.includes('присед');
          if (filters.exerciseType === 'deadlift') return raw.includes('deadlift') || raw.includes('тяга');
          if (filters.exerciseType === 'overhead_press') return raw.includes('overhead') || raw.includes('армейский');
          if (filters.exerciseType === 'cardio') return exType === 'cardio' || raw.includes('cardio') || raw.includes('бег');
          return true;
        });
        if (!hasMatchingExercise) return false;
      }

      // 3. Search query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const titleMatch = (session.title || '').toLowerCase().includes(q);
        const notesMatch = (session.notes || '').toLowerCase().includes(q);
        const exMatch = session.exercises.some((ex) =>
          (ex.exercise_name || '').toLowerCase().includes(q)
        );
        if (!titleMatch && !notesMatch && !exMatch) {
          return false;
        }
      }

      // 4. Date range
      const sessionDate = new Date(session.date || session.created_at);
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        if (sessionDate < start) return false;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (sessionDate > end) return false;
      }

      return true;
    });
  }, [sessions, filters, currentUser]);

  // Unified Feed Items (Singles + Sessions)
  const unifiedFeedItems = useMemo<FeedItem[]>(() => {
    const singleItems: FeedItem[] = filteredSingleWorkouts.map((w) => ({
      kind: 'single',
      id: w.id,
      date: w.date || w.created_at,
      data: w,
    }));

    const sessionItems: FeedItem[] = filteredSessions.map((s) => ({
      kind: 'session',
      id: s.id,
      date: s.date || s.created_at,
      data: s,
    }));

    return [...singleItems, ...sessionItems].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [filteredSingleWorkouts, filteredSessions]);

  // Overall athlete statistics from loaded workouts & sessions
  const stats = useMemo(() => {
    let totalTonnage = 0;
    let heaviest1RM = 0;
    let heaviestExercise = '';
    let totalCardioKm = 0;

    const userWorkouts = currentUser ? workouts.filter((w) => w.user_id === currentUser.id) : workouts;
    const userSessions = currentUser ? sessions.filter((s) => s.user_id === currentUser.id) : sessions;

    // Single workouts
    for (const w of userWorkouts) {
      if (isStrengthMetrics(w.metrics)) {
        const itemTonnage = w.metrics.detailed_sets && w.metrics.detailed_sets.length > 0
          ? calculateDetailedSetsTonnage(w.metrics.detailed_sets)
          : calculateSetTonnage(w.metrics.weight, w.metrics.sets, w.metrics.reps);
        totalTonnage += itemTonnage;

        const detailedSets = w.metrics.detailed_sets;
        const workingSets = detailedSets ? detailedSets.filter((s) => !s.is_warmup) : [];
        const candidateSets = workingSets.length > 0 ? workingSets : (detailedSets || []);
        const e1rm = candidateSets.length > 0
          ? Math.max(...candidateSets.map((s) => calculateOneRepMax(s.weight, s.reps)))
          : calculateOneRepMax(w.metrics.weight, w.metrics.reps);

        if (e1rm > heaviest1RM) {
          heaviest1RM = e1rm;
          heaviestExercise = formatExerciseName(w.type || w.metrics.exercise_type, t);
        }
      } else if (isCardioMetrics(w.metrics)) {
        totalCardioKm += w.metrics.distance_km;
      }
    }

    // Sessions
    for (const s of userSessions) {
      totalTonnage += s.total_tonnage;

      for (const ex of s.exercises) {
        if (ex.exercise_type === 'strength' || ex.exercise_type === 'bodyweight') {
          for (const st of ex.sets) {
            if (!st.is_warmup && st.weight > 0 && st.reps > 0) {
              const e1rm = calculateOneRepMax(st.weight, st.reps);
              if (e1rm > heaviest1RM) {
                heaviest1RM = e1rm;
                heaviestExercise = formatExerciseName(ex.exercise_name, t);
              }
            }
          }
        } else if (ex.exercise_type === 'cardio' && ex.distance_km) {
          totalCardioKm += ex.distance_km;
        }
      }
    }

    return {
      totalWorkouts: userWorkouts.length + userSessions.length,
      totalTonnage,
      heaviest1RM,
      heaviestExercise,
      totalCardioKm: Math.round(totalCardioKm * 10) / 10,
    };
  }, [workouts, sessions, currentUser, t]);

  // Group items by Date (sorted chronological descending)
  const groupedFeed = useMemo(() => {
    const groups: { [dateKey: string]: FeedItem[] } = {};
    for (const item of unifiedFeedItems) {
      const key = getWorkoutDateKey(item.date);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }

    return Object.entries(groups).map(([dateKey, items]) => {
      // Calculate day tonnage
      const dayTonnage = items.reduce((sum, item) => {
        if (item.kind === 'session') {
          return sum + item.data.total_tonnage;
        } else if (isStrengthMetrics(item.data.metrics)) {
          const itemTonnage = item.data.metrics.detailed_sets && item.data.metrics.detailed_sets.length > 0
            ? calculateDetailedSetsTonnage(item.data.metrics.detailed_sets)
            : calculateSetTonnage(item.data.metrics.weight, item.data.metrics.sets, item.data.metrics.reps);
          return sum + itemTonnage;
        }
        return sum;
      }, 0);

      return {
        dateKey,
        heading: formatDateGroupHeading(dateKey, {
          locale: locale === 'ru' ? 'ru-RU' : 'en-US',
          todayText: t('common.today'),
          yesterdayText: t('common.yesterday'),
          undatedText: t('common.undatedSessions'),
        }),
        items,
        dayTonnage,
      };
    });
  }, [unifiedFeedItems, locale, t]);

  // Handlers for single workouts
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

  // Handlers for complex sessions
  const handleOpenCreateSessionModal = () => {
    setSessionToEdit(null);
    setIsSessionModalOpen(true);
  };

  const handleOpenEditSessionModal = (session: WorkoutSession) => {
    setSessionToEdit(session);
    setIsSessionModalOpen(true);
  };

  const handleOpenDeleteSessionModal = (session: WorkoutSession) => {
    setSessionToDelete(session);
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeletingSession(true);
      await workoutSessionsApi.deleteWorkoutSession(sessionToDelete.id);
      setIsDeletingSession(false);
      setSessionToDelete(null);
      await fetchSessions();
      useWorkoutStore.setState({
        successMessage: t('workouts.sessionDeletedSuccess'),
      });
    } catch {
      setIsDeletingSession(false);
    }
  };

  const totalLoadedItemsCount = filteredSingleWorkouts.length + filteredSessions.length;

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
          <h1 className="text-2xl font-black text-white tracking-tight">{t('workouts.title')}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t('workouts.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            onClick={handleStartLiveWorkout}
            variant="primary"
            size="md"
            className="gap-2 shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black shadow-lg shadow-amber-950/40 border-0"
          >
            <Radio className="w-4 h-4 text-zinc-950 animate-pulse" />
            <span>
              {liveDraft && liveDraft.userId === currentUser?.id
                ? t('liveWorkout.resumeLiveWorkout')
                : t('liveWorkout.startLiveWorkout')}
            </span>
          </Button>
          <Button
            onClick={() => setIsCustomExerciseModalOpen(true)}
            variant="secondary"
            size="md"
            className="gap-2 shrink-0 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>{t('exercises.addCustomShort')}</span>
          </Button>
          <Button
            onClick={handleOpenCreateSessionModal}
            variant="secondary"
            size="md"
            className="gap-2 shrink-0 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-bold"
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>{t('workouts.complexSession')}</span>
          </Button>
          <Button onClick={handleOpenCreateModal} variant="primary" size="md" className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            <span>{t('workouts.logWorkout')}</span>
          </Button>
        </div>
      </div>

      {/* Live Workout In-Progress Banner */}
      {currentUser?.id && <LiveWorkoutBanner userId={currentUser.id} />}

      {/* Athlete Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/80 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {t('workouts.totalSessions')}
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
              {t('workouts.tonnage')}
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
              {t('workouts.heaviest1RM')}
            </span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-black text-amber-400 font-mono">
            {stats.heaviest1RM > 0 ? `${stats.heaviest1RM} ${t('common.kg')}` : '—'}
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
              {t('workouts.cardioDistance')}
            </span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-xl font-black text-cyan-400 font-mono">
            {stats.totalCardioKm > 0 ? `${stats.totalCardioKm} ${t('common.km')}` : '—'}
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <WorkoutFilters
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
        totalCount={totalLoadedItemsCount}
      />

      {/* Main Content Area */}
      {isLoading && isLoadingSessions ? (
        <Loader text={t('common.loading')} />
      ) : unifiedFeedItems.length === 0 ? (
        <Card className="border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Dumbbell className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white">{t('workouts.noWorkouts')}</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
            {t('workouts.noWorkoutsDesc')}
          </p>
          <div className="flex items-center justify-center gap-3">
            {(workouts.length > 0 || sessions.length > 0) && (
              <Button onClick={resetFilters} variant="secondary" size="sm">
                {t('workouts.resetFilters')}
              </Button>
            )}
            <Button onClick={handleOpenCreateSessionModal} variant="secondary" size="sm" className="gap-1">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>{t('workouts.complexSession')}</span>
            </Button>
            <Button onClick={handleOpenCreateModal} variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              <span>{t('workouts.logWorkout')}</span>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedFeed.map((group) => (
            <section key={group.dateKey} className="space-y-3">
              {/* Date Group Heading Banner */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    {group.heading}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                    {group.items.length}{' '}
                    {group.items.length === 1 ? t('workouts.session') : t('workouts.sessions')}
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
                {group.items.map((item) =>
                  item.kind === 'session' ? (
                    <WorkoutSessionCard
                      key={item.id}
                      session={item.data}
                      onEdit={handleOpenEditSessionModal}
                      onDelete={handleOpenDeleteSessionModal}
                    />
                  ) : (
                    <WorkoutCard
                      key={item.id}
                      workout={item.data}
                      onEdit={handleOpenEditModal}
                      onDelete={handleOpenDeleteModal}
                    />
                  )
                )}
              </div>
            </section>
          ))}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80 text-xs text-zinc-400">
            <div>
              {t('workouts.showingRecords', { count: totalLoadedItemsCount })}
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
                  fetchSessions();
                }}
                className="gap-1 px-3 py-1.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {t('workouts.previous')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={filteredSingleWorkouts.length < pagination.limit || isLoading}
                onClick={() => {
                  const newSkip = pagination.skip + pagination.limit;
                  setSkip(newSkip);
                  fetchWorkouts();
                  fetchSessions();
                }}
                className="gap-1 px-3 py-1.5"
              >
                {t('workouts.next')}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Single Workout Modal */}
      <WorkoutFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setWorkoutToEdit(null);
        }}
        workoutToEdit={workoutToEdit}
        onSuccess={() => {
          fetchWorkouts(true);
          fetchSessions();
        }}
      />

      {/* Delete Single Workout Confirmation Modal */}
      <DeleteWorkoutModal
        isOpen={Boolean(workoutToDelete)}
        onClose={() => setWorkoutToDelete(null)}
        workout={workoutToDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Custom Exercise Modal */}
      <CustomExerciseModal
        isOpen={isCustomExerciseModalOpen}
        onClose={() => setIsCustomExerciseModalOpen(false)}
        onCreated={() => {
          setIsCustomExerciseModalOpen(false);
        }}
      />

      {/* Complex Workout Session Modal */}
      <WorkoutSessionModal
        isOpen={isSessionModalOpen}
        sessionToEdit={sessionToEdit}
        onClose={() => {
          setIsSessionModalOpen(false);
          setSessionToEdit(null);
        }}
        onSuccess={() => {
          fetchWorkouts(true);
          fetchSessions();
          useWorkoutStore.setState({
            successMessage: sessionToEdit
              ? t('workouts.sessionUpdatedSuccess')
              : t('workouts.sessionCreatedSuccess'),
          });
          setSessionToEdit(null);
        }}
      />

      {/* Delete Session Confirmation Modal */}
      <Modal
        isOpen={Boolean(sessionToDelete)}
        onClose={() => setSessionToDelete(null)}
        title={t('workouts.deleteConfirmTitle')}
        description={t('workouts.deleteConfirmDesc')}
      >
        <div className="flex justify-end items-center gap-3 pt-4 border-t border-zinc-800">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSessionToDelete(null)}
            disabled={isDeletingSession}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={isDeletingSession}
            onClick={handleConfirmDeleteSession}
          >
            {t('workouts.deleteTitle')}
          </Button>
        </div>
      </Modal>

      {/* Live Interactive Workout Modal */}
      {currentUser?.id && (
        <LiveWorkoutModal
          userId={currentUser.id}
          onSuccess={() => {
            fetchWorkouts(true);
            fetchSessions();
          }}
        />
      )}
    </div>
  );
};

export default WorkoutsPage;
