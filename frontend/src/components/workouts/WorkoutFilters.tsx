import React from 'react';
import { Filter, Search, RotateCcw, Calendar } from 'lucide-react';
import { WorkoutFiltersState } from '@/types/workout';
import { Button } from '@/components/ui/Button';
import { useLocaleStore } from '@/store/useLocaleStore';
import type { TranslationKey } from '@/locales';

export interface WorkoutFiltersProps {
  filters: WorkoutFiltersState;
  onFilterChange: <K extends keyof WorkoutFiltersState>(key: K, value: WorkoutFiltersState[K]) => void;
  onReset: () => void;
  totalCount?: number;
}

interface ChipItem {
  id: string;
  key: TranslationKey;
}

const MOVEMENT_CHIPS: ChipItem[] = [
  { id: 'all', key: 'workouts.allLifts' },
  { id: 'bench_press', key: 'workouts.bench_press' },
  { id: 'squats', key: 'workouts.squat' },
  { id: 'deadlift', key: 'workouts.deadlift' },
  { id: 'overhead_press', key: 'workouts.overhead_press' },
  { id: 'cardio', key: 'workouts.cardio' },
];

export const WorkoutFilters: React.FC<WorkoutFiltersProps> = ({
  filters,
  onFilterChange,
  onReset,
  totalCount,
}) => {
  const { t } = useLocaleStore();

  const hasActiveFilters =
    filters.exerciseType !== 'all' ||
    Boolean(filters.searchQuery) ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  return (
    <div className="space-y-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
      {/* Top row: Filter chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-zinc-400 mr-1 select-none">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden sm:inline">{t('workouts.category')}:</span>
          </div>
          {MOVEMENT_CHIPS.map((chip) => {
            const isActive = filters.exerciseType === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onFilterChange('exerciseType', chip.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all select-none ${
                  isActive
                    ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {t(chip.key)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Second row: Search & Date ranges */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1 border-t border-zinc-800/50">
        {/* Search */}
        <div className="sm:col-span-5 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            placeholder={t('workouts.searchPlaceholder')}
            value={filters.searchQuery}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Date range from */}
        <div className="sm:col-span-3 relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
            className="w-full pl-8 pr-2.5 py-2 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 focus:border-amber-500 focus:outline-none"
            title={t('workouts.startDate')}
          />
        </div>

        {/* Date range to */}
        <div className="sm:col-span-3 relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
            className="w-full pl-8 pr-2.5 py-2 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 focus:border-amber-500 focus:outline-none"
            title={t('workouts.endDate')}
          />
        </div>

        {/* Reset button */}
        <div className="sm:col-span-1 flex justify-end">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-zinc-400 hover:text-zinc-100 h-8 px-2"
              title={t('workouts.resetFilters')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {totalCount !== undefined && (
        <div className="text-[11px] text-zinc-500 flex justify-between items-center pt-1">
          <span>{t('workouts.matchingRecords', { count: totalCount })}</span>
          {hasActiveFilters && <span className="text-amber-500/80">{t('workouts.filtersApplied')}</span>}
        </div>
      )}
    </div>
  );
};

export default WorkoutFilters;
