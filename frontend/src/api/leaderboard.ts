import apiClient from './client';
import { LeaderboardResponse, UserRankResponse } from '@/types/leaderboard';

export const leaderboardApi = {
  /**
   * Retrieve paginated leaderboard ranked by total tonnage lifted.
   */
  async getTonnage(limit = 10, offset = 0): Promise<LeaderboardResponse> {
    const response = await apiClient.get<LeaderboardResponse>('/leaderboard/tonnage', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Retrieve tonnage rank and score of currently authenticated athlete.
   */
  async getMyRank(): Promise<UserRankResponse> {
    const response = await apiClient.get<UserRankResponse>('/leaderboard/me');
    return response.data;
  },

  /**
   * Retrieve tonnage rank and score for a specific athlete.
   */
  async getUserRank(userId: string): Promise<UserRankResponse> {
    const response = await apiClient.get<UserRankResponse>(`/leaderboard/tonnage/users/${userId}`);
    return response.data;
  },
};

export default leaderboardApi;
