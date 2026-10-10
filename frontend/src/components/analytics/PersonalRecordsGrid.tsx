import React from 'react';
import { Trophy, Dumbbell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

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

export const PersonalRecordsGrid: React.FC<PersonalRecordsGridProps> = ({ records }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-bold text-zinc-100">Personal Records (PRs)</h3>
        </div>
        <span className="text-xs text-zinc-400">All-time peak performance</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {records.map((pr) => {
          const hasRecord = pr.max1RM > 0;

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
                    {hasRecord ? 'PR' : 'No Data'}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-bold text-zinc-100 text-base">{pr.name}</h4>
                  <span className="text-xs text-zinc-500 capitalize">{pr.category}</span>
                </div>

                <div className="border-t border-zinc-800/80 pt-3">
                  <div className="text-[11px] text-zinc-400 uppercase font-semibold">
                    Estimated 1RM
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-400 mt-0.5">
                    {hasRecord ? `${pr.max1RM} kg` : '—'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-zinc-800/40 pt-2 text-zinc-400">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Heavy Set</span>
                    {hasRecord ? `${pr.maxWeight}kg × ${pr.repsAtMax}` : '—'}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 block">Date</span>
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
