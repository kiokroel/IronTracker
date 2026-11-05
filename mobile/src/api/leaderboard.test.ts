import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeaderboardResponse, UserRankResponse } from "../types";
import apiClient from "./client";
import {
  fetchMyTonnageRank,
  fetchTonnageLeaderboard,
  fetchUserTonnageRank,
  leaderboardApi,
} from "./leaderboard";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

describe("Leaderboard API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLeaderboardResponse: LeaderboardResponse = {
    metric: "tonnage",
    total_entries: 3,
    entries: [
      {
        rank: 1,
        user_id: "user-1",
        score: 15400,
        username: "AlexStrong",
      },
      {
        rank: 2,
        user_id: "user-2",
        score: 12250,
        username: "IronBeast",
      },
      {
        rank: 3,
        user_id: "user-3",
        score: 9800,
        username: "ElenaFit",
      },
    ],
  };

  const mockUserRankResponse: UserRankResponse = {
    user_id: "user-me-123",
    rank: 5,
    score: 8450,
  };

  describe("fetchTonnageLeaderboard", () => {
    it("calls GET /leaderboard/tonnage with default limit=10 and offset=0", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockLeaderboardResponse,
      });

      const result = await fetchTonnageLeaderboard();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith("/leaderboard/tonnage", {
        params: { limit: 10, offset: 0 },
      });
      expect(result).toEqual(mockLeaderboardResponse);
    });

    it("calls GET /leaderboard/tonnage with customized limit and offset", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          metric: "tonnage",
          total_entries: 0,
          entries: [],
        },
      });

      const result = await fetchTonnageLeaderboard(50, 20);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith("/leaderboard/tonnage", {
        params: { limit: 50, offset: 20 },
      });
      expect(result.entries).toHaveLength(0);
    });

    it("propagates error when GET /leaderboard/tonnage rejects", async () => {
      const networkError = new Error("Redis service unavailable");
      vi.mocked(apiClient.get).mockRejectedValueOnce(networkError);

      await expect(fetchTonnageLeaderboard()).rejects.toThrow(
        "Redis service unavailable"
      );
      expect(apiClient.get).toHaveBeenCalledWith("/leaderboard/tonnage", {
        params: { limit: 10, offset: 0 },
      });
    });
  });

  describe("fetchMyTonnageRank", () => {
    it("calls GET /leaderboard/me and returns current user rank response", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockUserRankResponse,
      });

      const result = await fetchMyTonnageRank();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith("/leaderboard/me");
      expect(result).toEqual(mockUserRankResponse);
      expect(result.rank).toBe(5);
      expect(result.score).toBe(8450);
    });

    it("handles unranked user with null rank", async () => {
      const unrankedResponse: UserRankResponse = {
        user_id: "user-newbie",
        rank: null,
        score: 0,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: unrankedResponse,
      });

      const result = await fetchMyTonnageRank();

      expect(result.rank).toBeNull();
      expect(result.score).toBe(0);
    });

    it("propagates error when GET /leaderboard/me fails", async () => {
      const authError = new Error("Unauthorized");
      vi.mocked(apiClient.get).mockRejectedValueOnce(authError);

      await expect(fetchMyTonnageRank()).rejects.toThrow("Unauthorized");
      expect(apiClient.get).toHaveBeenCalledWith("/leaderboard/me");
    });
  });

  describe("fetchUserTonnageRank", () => {
    it("calls GET /leaderboard/tonnage/users/{userId} with user uuid", async () => {
      const targetUserId = "user-target-789";
      const targetUserResponse: UserRankResponse = {
        user_id: targetUserId,
        rank: 2,
        score: 12250,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: targetUserResponse,
      });

      const result = await fetchUserTonnageRank(targetUserId);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/leaderboard/tonnage/users/${targetUserId}`
      );
      expect(result).toEqual(targetUserResponse);
    });

    it("propagates error when user tonnage rank call fails", async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("User Not Found"));

      await expect(fetchUserTonnageRank("non-existent")).rejects.toThrow(
        "User Not Found"
      );
    });
  });

  describe("leaderboardApi namespace", () => {
    it("exposes all api functions through leaderboardApi object", () => {
      expect(leaderboardApi.fetchTonnageLeaderboard).toBe(fetchTonnageLeaderboard);
      expect(leaderboardApi.fetchMyTonnageRank).toBe(fetchMyTonnageRank);
      expect(leaderboardApi.fetchUserTonnageRank).toBe(fetchUserTonnageRank);
    });
  });
});
