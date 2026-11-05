import type { LeaderboardResponse, UserRankResponse } from "../types";
import apiClient from "./client";

/**
 * Retrieve paginated leaderboard ranked by total tonnage lifted in descending order.
 */
export async function fetchTonnageLeaderboard(
  limit = 10,
  offset = 0
): Promise<LeaderboardResponse> {
  const response = await apiClient.get<LeaderboardResponse>(
    "/leaderboard/tonnage",
    {
      params: { limit, offset },
    }
  );
  return response.data;
}

/**
 * Retrieve ranking position and total tonnage score for the authenticated user from JWT token.
 */
export async function fetchMyTonnageRank(): Promise<UserRankResponse> {
  const response = await apiClient.get<UserRankResponse>("/leaderboard/me");
  return response.data;
}

/**
 * Retrieve ranking position and total tonnage score for a specific user by ID.
 */
export async function fetchUserTonnageRank(
  userId: string
): Promise<UserRankResponse> {
  const response = await apiClient.get<UserRankResponse>(
    `/leaderboard/tonnage/users/${userId}`
  );
  return response.data;
}

export const leaderboardApi = {
  fetchTonnageLeaderboard,
  fetchMyTonnageRank,
  fetchUserTonnageRank,
};

export default leaderboardApi;
