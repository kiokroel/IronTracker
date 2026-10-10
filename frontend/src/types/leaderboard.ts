export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  score: number;
  username?: string;
}

export interface LeaderboardResponse {
  metric: string;
  total_entries: number;
  entries: LeaderboardEntry[];
}

export interface UserRankResponse {
  user_id: string;
  rank: number | null;
  score: number;
}
