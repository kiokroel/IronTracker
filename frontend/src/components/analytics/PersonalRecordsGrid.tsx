import React from 'react';
import { Trophy, Dumbbell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useLocaleStore } from '@/store/useLocaleStore';
import type { TranslationKey } from '@/locales';

export interface PersonalRecordItem {
  id: string;
  name: string;
  category: string;
  max1RM: number;
  maxWeight: number;
  repsAtMax: number;
  date: string;
}

interface PersonalRecordsGridProps {
  records: PersonalRecordItem[];
}

const EXERCISE_KEY_MAP: Record<string, TranslationKey> = {
  bench: 'workouts.bench_press',
  squat: 'workouts.squat',
  deadlift: 'workouts.deadlift',
  overhead: 'workouts.overhead_press',
};

const CATEGORY_KEY_MAP: Record<string, TranslationKey> = {
  bench: 'analytics.upperBodyPush',
  squat: 'analytics.lowerBodyQuad',
  deadlift: 'analytics.posteriorChain',
  overhead: 'analytics.verticalPush',
};

export const PersonalRecordsGrid: React.FC<PersonalRecordsGridProps> = ({ records }) => {
  const { t } = useLocaleStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-bold text-zinc-100">{t('analytics.personalRecordsTitle')}</h3>
        </div>
        <span className="text-xs text-zinc-400">{t('analytics.allTimePeak')}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {records.map((pr) => {
          const hasRecord = pr.max1RM > 0;
          const exerciseLabel = EXERCISE_KEY_MAP[pr.id] ? t(EXERCISE_KEY_MAP[pr.id]) : pr.name;
          const categoryLabel = CATEGORY_KEY_MAP[pr.id] ? t(CATEGORY_KEY_MAP[pr.id]) : pr.category;

          return (
            <Card
              key={pr.id}
              className={`relative overflow-hidden border-zinc-800 transition-all ${
                hasRecord
                  ? 'bg-zinc-900/80 hover:border-amber-500/40 shadow-md'
                  : 'bg-zinc-900/30 opacity-60'
              }`}
            >
              {hasRecord && (
                <div className="absolute top-0 right-0 h-16 w-16 bg-amber-500/10 rounded-bl-full pointer-events-none" />
              )}

              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <Badge variant={hasRecord ? 'accent' : 'default'} size="sm">
                    {hasRecord ? t('analytics.prBadge') : t('analytics.noDataBadge')}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-bold text-zinc-100 text-base">{exerciseLabel}</h4>
                  <span className="text-xs text-zinc-500 capitalize">{categoryLabel}</span>
                </div>

                <div className="border-t border-zinc-800/80 pt-3">
                  <div className="text-[11px] text-zinc-400 uppercase font-semibold">
                    {t('analytics.estimatedMax')}
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-400 mt-0.5">
                    {hasRecord ? `${pr.max1RM} ${t('common.kg')}` : '—'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-zinc-800/40 pt-2 text-zinc-400">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">{t('analytics.heavySet')}</span>
                    {hasRecord ? `${pr.maxWeight}${t('common.kg')} × ${pr.repsAtMax}` : '—'}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 block">{t('analytics.date')}</span>
                    {hasRecord ? pr.date : '—'}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PersonalRecordsGrid;
