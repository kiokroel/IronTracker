import React from 'react';
import { Trophy, TrendingUp, Award, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatWeight } from '@/utils/fitness';
import { UserRankResponse } from '@/types/leaderboard';

interface UserRankCardProps {
  myRank: UserRankResponse | null;
  gapToNextRank: number | null;
  totalEntries: number;
}

export const UserRankCard: React.FC<UserRankCardProps> = ({
  myRank,
  gapToNextRank,
  totalEntries,
}) => {
  const rank = myRank?.rank;
  const score = myRank?.score ?? 0;

  const getRankBadgeInfo = (): { label: string; variant: 'default' | 'accent' | 'outline' } => {
    if (!rank) return { label: 'Unranked', variant: 'default' };
    if (rank === 1) return { label: 'Leader #1', variant: 'accent' };
    if (rank <= 3) return { label: `Podium #${rank}`, variant: 'accent' };
    if (rank <= 10) return { label: `Top 10 (#${rank})`, variant: 'accent' };
    return { label: `Rank #${rank}`, variant: 'outline' };
  };

  const badgeInfo = getRankBadgeInfo();

  return (
    <Card className="relative overflow-hidden border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 p-6 shadow-xl">
      {/* Decorative background glow */}
      <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 shadow-inner">
            <Trophy className="h-7 w-7" />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-zinc-100">
                Your Iron Rank
              </h2>
              <Badge variant={badgeInfo.variant} size="sm">
                {badgeInfo.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Personal standing in the global tonnage leaderboard calculated via Redis ZSET.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-zinc-800/80 pt-4 md:border-t-0 md:pt-0">
          {/* Position */}
          <div className="rounded-xl bg-zinc-800/50 p-3.5 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-amber-400" />
              Position
            </div>
            <div className="mt-1 text-2xl font-black font-mono text-zinc-100">
              {rank ? `#${rank}` : '—'}
              {rank && totalEntries > 0 && (
                <span className="text-xs font-normal text-zinc-500 ml-1">
                  / {totalEntries}
                </span>
              )}
            </div>
          </div>

          {/* Total Lifted */}
          <div className="rounded-xl bg-zinc-800/50 p-3.5 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Total Lifted
            </div>
            <div className="mt-1 text-2xl font-black font-mono text-amber-400">
              {formatWeight(score)}
            </div>
          </div>

          {/* Gap to next */}
          <div className="col-span-2 sm:col-span-1 rounded-xl bg-zinc-800/50 p-3.5 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              To Next Rank
            </div>
            <div className="mt-1 text-2xl font-black font-mono text-zinc-100">
              {rank === 1 ? (
                <span className="text-sm font-semibold text-amber-400 flex items-center gap-1">
                  At the peak 👑
                </span>
              ) : gapToNextRank !== null ? (
                <span className="text-emerald-400">
                  +{formatWeight(gapToNextRank)}
                </span>
              ) : (
                <span className="text-sm text-zinc-500">Log workout</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default UserRankCard;
