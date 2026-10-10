import { create } from 'zustand';
import axios from 'axios';
import { workoutsApi } from '@/api/workouts';
import { Workout, WorkoutCreate, WorkoutUpdate, WorkoutFiltersState } from '@/types/workout';
import { useAuthStore } from './useAuthStore';

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { msg?: string; loc?: (string | number)[] }) => {
          const field = d.loc?.filter((x) => x !== 'body').join('.');
          return field ? `${field}: ${d.msg}` : d.msg || 'Validation error';
        })
        .join('; ');
    }
    if (err.response?.status === 403) {
      return 'Access denied: You do not have permission to modify or delete this workout record.';
    }
    if (err.response?.status === 404) {
      return 'Workout record not found.';
    }
    if (err.response?.status === 401) {
      return 'Your session has expired. Please authenticate again.';
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export const initialFilters: WorkoutFiltersState = {
  exerciseType: 'all',
  searchQuery: '',
  startDate: '',
  endDate: '',
  onlyMyWorkouts: false,
};

interface PaginationState {
  skip: number;
  limit: number;
  hasMore: boolean;
}

interface WorkoutStoreState {
  workouts: Workout[];
  selectedWorkout: Workout | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  error: string | null;
  successMessage: string | null;
  filters: WorkoutFiltersState;
  pagination: PaginationState;

  // Actions
  fetchWorkouts: (resetPagination?: boolean) => Promise<void>;
  fetchWorkoutById: (id: string) => Promise<Workout>;
  createWorkout: (data: WorkoutCreate) => Promise<Workout>;
  updateWorkout: (id: string, data: WorkoutUpdate) => Promise<Workout>;
  deleteWorkout: (id: string) => Promise<void>;
  setSelectedWorkout: (workout: Workout | null) => void;
  setFilter: <K extends keyof WorkoutFiltersState>(key: K, value: WorkoutFiltersState[K]) => void;
  resetFilters: () => void;
  setSkip: (skip: number) => void;
  clearError: () => void;
  clearSuccess: () => void;
}

export const useWorkoutStore = create<WorkoutStoreState>((set, get) => ({
  workouts: [],
  selectedWorkout: null,
  isLoading: false,
  isSubmitting: false,
  isDeleting: false,
  error: null,
  successMessage: null,
  filters: { ...initialFilters },
  pagination: {
    skip: 0,
    limit: 50,
    hasMore: true,
  },

  fetchWorkouts: async (resetPagination = false) => {
    set({ isLoading: true, error: null });
    try {
      const { pagination, filters } = get();
      const currentSkip = resetPagination ? 0 : pagination.skip;
      const currentUser = useAuthStore.getState().user;

      const params = {
        skip: currentSkip,
        limit: pagination.limit,
        user_id: filters.onlyMyWorkouts && currentUser ? currentUser.id : undefined,
      };

      const data = await workoutsApi.getWorkouts(params);

      set({
        workouts: data,
        isLoading: false,
        pagination: {
          ...pagination,
          skip: currentSkip,
          hasMore: data.length === pagination.limit,
        },
      });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to retrieve workout journal records.');
      set({ isLoading: false, error: msg });
    }
  },

  fetchWorkoutById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workout = await workoutsApi.getWorkoutById(id);
      set({ selectedWorkout: workout, isLoading: false });
      return workout;
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to retrieve workout details.');
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  createWorkout: async (data: WorkoutCreate) => {
    set({ isSubmitting: true, error: null });
    try {
      const created = await workoutsApi.createWorkout(data);
      // Prepend newly created workout to the local list
      set((state) => ({
        workouts: [created, ...state.workouts],
        isSubmitting: false,
        successMessage: 'Workout session successfully recorded!',
      }));
      return created;
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to save workout session.');
      set({ isSubmitting: false, error: msg });
      throw new Error(msg);
    }
  },

  updateWorkout: async (id: string, data: WorkoutUpdate) => {
    set({ isSubmitting: true, error: null });
    try {
      const updated = await workoutsApi.updateWorkout(id, data);
      // Update local workouts array
      set((state) => ({
        workouts: state.workouts.map((w) => (w.id === id ? updated : w)),
        selectedWorkout: state.selectedWorkout?.id === id ? updated : state.selectedWorkout,
        isSubmitting: false,
        successMessage: 'Workout record updated successfully!',
      }));
      return updated;
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to update workout record.');
      set({ isSubmitting: false, error: msg });
      throw new Error(msg);
    }
  },

  deleteWorkout: async (id: string) => {
    set({ isDeleting: true, error: null });
    try {
      await workoutsApi.deleteWorkout(id);
      // Remove from local workouts array
      set((state) => ({
        workouts: state.workouts.filter((w) => w.id !== id),
        selectedWorkout: state.selectedWorkout?.id === id ? null : state.selectedWorkout,
        isDeleting: false,
        successMessage: 'Workout record deleted successfully.',
      }));
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to delete workout record.');
      set({ isDeleting: false, error: msg });
      throw new Error(msg);
    }
  },

  setSelectedWorkout: (workout) => {
    set({ selectedWorkout: workout });
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    }));
  },

  resetFilters: () => {
    set({ filters: { ...initialFilters } });
  },

  setSkip: (skip) => {
    set((state) => ({
      pagination: {
        ...state.pagination,
        skip,
      },
    }));
  },

  clearError: () => {
    set({ error: null });
  },

  clearSuccess: () => {
    set({ successMessage: null });
  },
}));

export default useWorkoutStore;
