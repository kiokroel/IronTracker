import React from 'react';
import { Medal, Trophy, User } from 'lucide-react';
import { LeaderboardEntry } from '@/types/leaderboard';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { formatWeight } from '@/utils/fitness';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: string | null;
  isLoading: boolean;
  limit: number;
  onLimitChange: (limit: number) => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  entries,
  currentUserId,
  isLoading,
  limit,
  onLimitChange,
}) => {
  const topScore = entries.length > 0 ? entries[0].score : 0;

  const renderRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm font-bold">
            <Trophy className="h-4 w-4" />
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-300/20 text-slate-300 border border-slate-300/40 shadow-sm font-bold">
            <Medal className="h-4 w-4" />
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-800/20 text-amber-600 border border-amber-700/40 shadow-sm font-bold">
            <Medal className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <span className="font-mono font-bold text-sm text-zinc-400">
            #{rank}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          Showing <span className="font-semibold text-zinc-200">{entries.length}</span> top athletes
        </span>

        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>Show:</span>
          {[10, 25, 50].map((size) => (
            <button
              key={size}
              onClick={() => onLimitChange(size)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                limit === size
                  ? 'bg-amber-500 text-zinc-950 font-bold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              Top {size}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
        {isLoading && entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader size="lg" />
            <p className="mt-4 text-sm text-zinc-400">Loading standings from Redis ZSET...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="h-12 w-12 text-zinc-600" />
            <h3 className="mt-4 text-base font-semibold text-zinc-300">No athletes ranked yet</h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              Be the first to record a workout and claim the top spot on the leaderboard!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/60 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th scope="col" className="w-16 px-6 py-3.5 text-center">Rank</th>
                  <th scope="col" className="px-6 py-3.5">Athlete</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Volume Progress</th>
                  <th scope="col" className="w-40 px-6 py-3.5 text-right">Total Tonnage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {entries.map((entry) => {
                  const isCurrent = currentUserId === entry.user_id;
                  const relativePct = topScore > 0 ? Math.min(100, Math.round((entry.score / topScore) * 100)) : 0;

                  return (
                    <tr
                      key={`${entry.user_id}-${entry.rank}`}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-amber-500/10 hover:bg-amber-500/15 font-medium'
                          : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Rank badge */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          {renderRankBadge(entry.rank)}
                        </div>
                      </td>

                      {/* Athlete info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            isCurrent
                              ? 'bg-amber-500 text-zinc-950'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}>
                            <User className="h-4 w-4" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-100">
                                {entry.username || `Athlete ${entry.user_id.slice(0, 8)}`}
                              </span>
                              {isCurrent && (
                                <Badge variant="accent" size="sm">
                                  You
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-zinc-500 block">
                              ID: {entry.user_id.slice(0, 16)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Relative progress bar */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="hidden sm:block w-32 h-2 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                entry.rank === 1
                                  ? 'bg-amber-400'
                                  : entry.rank === 2
                                  ? 'bg-slate-300'
                                  : entry.rank === 3
                                  ? 'bg-amber-600'
                                  : 'bg-zinc-600'
                              }`}
                              style={{ width: `${relativePct}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-zinc-400">
                            {relativePct}%
                          </span>
                        </div>
                      </td>

                      {/* Score */}
                      <td className="px-6 py-4 text-right">
                        <span className={`font-mono font-bold text-base ${
                          entry.rank === 1 ? 'text-amber-400' : 'text-zinc-100'
                        }`}>
                          {formatWeight(entry.score)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardTable;
