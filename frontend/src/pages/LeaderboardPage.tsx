import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Flame, RefreshCw, UserCheck } from 'lucide-react';
import { leaderboardApi } from '@/api/leaderboard';
import { useAuthStore } from '@/store/useAuthStore';
import { LeaderboardEntry, UserRankResponse } from '@/types/leaderboard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { formatWeight } from '@/utils/fitness';

export const LeaderboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [myRank, setMyRank] = useState<UserRankResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLeaderboard = async () => {
    try {
      const [boardData, rankData] = await Promise.allSettled([
        leaderboardApi.getTonnage(50, 0),
        leaderboardApi.getMyRank(),
      ]);

      if (boardData.status === 'fulfilled') {
        setEntries(boardData.value.entries);
        setTotalEntries(boardData.value.total_entries);
      }
      if (rankData.status === 'fulfilled') {
        setMyRank(rankData.value);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLeaderboard();
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-zinc-950 font-black text-xs shadow-md shadow-amber-500/30">
          <Medal className="w-4 h-4" />
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-300 text-zinc-950 font-black text-xs">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-amber-100 font-black text-xs">
          3
        </span>
      );
    }
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-zinc-400 font-bold text-xs">
        {rank}
      </span>
    );
  };

  if (isLoading) {
    return <Loader fullScreen text="Loading tonnage rankings..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span>Tonnage Leaderboard</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Global rankings ranked strictly by cumulative weight moved
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="secondary"
          size="sm"
          isLoading={isRefreshing}
          className="self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* User's Current Position Banner */}
      {myRank && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                    Your Standing
                  </span>
                  <Badge variant="accent" size="sm">
                    {user?.username}
                  </Badge>
                </div>
                <div className="text-xl font-black text-white mt-0.5">
                  {myRank.rank ? `Rank #${myRank.rank}` : 'Unranked (0 kg logged)'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-xs text-zinc-400 block">Total Volume</span>
                <span className="text-xl font-black text-white font-mono flex items-center gap-1 justify-end">
                  <Flame className="w-4 h-4 text-red-500 inline" />
                  {formatWeight(myRank.score)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Table Card */}
      <Card className="border-zinc-800 bg-zinc-900/90 overflow-hidden">
        <CardHeader className="border-b border-zinc-800/80 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Top Iron Lifters</CardTitle>
              <CardDescription>
                Displaying top contenders • Total registered participants: {totalEntries}
              </CardDescription>
            </div>
            <Badge variant="outline" size="sm">
              All-Time
            </Badge>
          </div>
        </CardHeader>

        {entries.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <Trophy className="mx-auto h-12 w-12 text-zinc-700 mb-2" />
            <p className="text-sm font-semibold text-zinc-300">No entries recorded yet</p>
            <p className="text-xs text-zinc-500 mt-1">Be the first athlete to log a workout!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3.5 w-16 text-center">Rank</th>
                  <th className="px-6 py-3.5">Athlete</th>
                  <th className="px-6 py-3.5 text-right">Tonnage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {entries.map((entry) => {
                  const isCurrent = user?.id === entry.user_id;
                  return (
                    <tr
                      key={`${entry.user_id}-${entry.rank}`}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-amber-500/10 font-medium'
                          : 'hover:bg-zinc-850/50'
                      }`}
                    >
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">{getRankBadge(entry.rank)}</div>
                      </td>
                      <td className="px-6 py-4">
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
                          {entry.user_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-bold text-base text-zinc-100">
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
      </Card>
    </div>
  );
};

export default LeaderboardPage;
