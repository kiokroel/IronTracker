import React, { useEffect } from 'react';
import { Trophy, RefreshCw, Flame, Clock, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaderboardStore } from '@/store/useLeaderboardStore';
import { LeaderboardPeriod } from '@/types/leaderboard';
import { Button } from '@/components/ui/Button';
import { UserRankCard } from '@/components/leaderboard/UserRankCard';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';

export const LeaderboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    entries,
    totalEntries,
    myRank,
    period,
    limit,
    isLoading,
    isRefreshing,
    error,
    lastSyncedAt,
    gapToNextRank,
    fetchLeaderboard,
    fetchMyRank,
    refreshAll,
    setLimit,
    setPeriod,
    clearError,
  } = useLeaderboardStore();

  useEffect(() => {
    fetchLeaderboard();
    if (user?.id) {
      fetchMyRank();
    }
  }, [user?.id, fetchLeaderboard, fetchMyRank]);

  const periods: { id: LeaderboardPeriod; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: 'month', label: 'This Month' },
    { id: 'week', label: 'This Week' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Trophy className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">
              Tonnage Leaderboard
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-zinc-400">
            Real-time athlete standings calculated instantly using Redis Sorted Sets (ZSET).
          </p>
        </div>

        {/* Sync Status & Refresh Button */}
        <div className="flex items-center gap-3">
          {lastSyncedAt && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock className="h-3.5 w-3.5" />
              <span>Synced {lastSyncedAt.toLocaleTimeString()}</span>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-400 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-xs underline hover:text-red-300 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* User Personal Rank Card */}
      <UserRankCard
        myRank={myRank}
        gapToNextRank={gapToNextRank}
        totalEntries={totalEntries}
      />

      {/* Period Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mr-2 flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-amber-500" />
          Period:
        </span>
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              period === p.id
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main Leaderboard Table */}
      <LeaderboardTable
        entries={entries}
        currentUserId={user?.id}
        isLoading={isLoading}
        limit={limit}
        onLimitChange={setLimit}
      />
    </div>
  );
};

export default LeaderboardPage;
