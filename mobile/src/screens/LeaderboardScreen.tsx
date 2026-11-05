import {
  AlertCircle,
  Award,
  Crown,
  Medal,
  RefreshCw,
  Trophy,
  User as UserIcon,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  fetchMyTonnageRank,
  fetchTonnageLeaderboard,
} from "../api/leaderboard";
import { Card } from "../components/common/Card";
import { Header } from "../components/common/Header";
import { useAuthStore } from "../store/useAuthStore";
import { colors } from "../theme/colors";
import type { LeaderboardEntry, UserRankResponse } from "../types";
import { formatWeight } from "../utils/fitness";

export const LeaderboardScreen: React.FC = () => {
  const { user } = useAuthStore();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState<number>(0);
  const [myRank, setMyRank] = useState<UserRankResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [boardRes, rankRes] = await Promise.allSettled([
        fetchTonnageLeaderboard(50, 0),
        fetchMyTonnageRank(),
      ]);

      if (boardRes.status === "fulfilled") {
        setEntries(boardRes.value.entries || []);
        setTotalEntries(boardRes.value.total_entries || 0);
      } else {
        throw boardRes.reason;
      }

      if (rankRes.status === "fulfilled") {
        setMyRank(rankRes.value);
      } else {
        // Fallback: search current user inside fetched entries
        if (user?.id && boardRes.status === "fulfilled") {
          const found = boardRes.value.entries.find(
            (e) => e.user_id === user.id
          );
          if (found) {
            setMyRank({
              user_id: user.id,
              rank: found.rank,
              score: found.score,
            });
          }
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Не удалось загрузить лидерборд";
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadLeaderboardData();
  }, [loadLeaderboardData]);

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <View style={[styles.medalContainer, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
          <Crown size={22} color="#f59e0b" />
        </View>
      );
    }
    if (rank === 2) {
      return (
        <View style={[styles.medalContainer, { backgroundColor: "rgba(148, 163, 184, 0.15)" }]}>
          <Award size={22} color="#94a3b8" />
        </View>
      );
    }
    if (rank === 3) {
      return (
        <View style={[styles.medalContainer, { backgroundColor: "rgba(217, 119, 6, 0.15)" }]}>
          <Medal size={22} color="#d97706" />
        </View>
      );
    }
    return (
      <View style={styles.numericRankContainer}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>
    );
  };

  const getAthleteDisplayName = (item: LeaderboardEntry) => {
    const isCurrentUser = user?.id && item.user_id === user.id;
    if (isCurrentUser) {
      return `${user.username || "Вы"} (Вы)`;
    }
    if (item.username) {
      return item.username;
    }
    return `Атлет #${item.user_id.slice(0, 6)}`;
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrent = Boolean(user?.id && item.user_id === user.id);
    const scoreVal = item.score ?? item.total_tonnage ?? 0;

    return (
      <Card style={[styles.entryCard, isCurrent && styles.currentAthleteCard]}>
        <View style={styles.entryRow}>
          <View style={styles.rankCol}>{renderRankBadge(item.rank)}</View>

          <View style={styles.infoCol}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.athleteName, isCurrent && styles.currentAthleteName]}
                numberOfLines={1}
              >
                {getAthleteDisplayName(item)}
              </Text>
              {isCurrent && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>ВЫ</Text>
                </View>
              )}
            </View>
            <Text style={styles.athleteMeta}>
              {item.rank <= 3
                ? `Призовое ${item.rank}-е место`
                : `Позиция в рейтинге: #${item.rank}`}
            </Text>
          </View>

          <View style={styles.scoreCol}>
            <Text style={[styles.scoreValue, isCurrent && styles.currentScoreValue]}>
              {formatWeight(scoreVal)}
            </Text>
            <Text style={styles.scoreUnit}>тоннаж</Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderHeader = () => {
    return (
      <View style={styles.listHeaderContainer}>
        {/* Banner Card */}
        <Card style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <View style={styles.trophyIconWrapper}>
              <Trophy size={26} color={colors.brand.primary} />
            </View>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>Соревновательный рейтинг</Text>
              <Text style={styles.bannerSubtitle}>
                Учитывается суммарный поднятый тоннаж в рабочих подходах (Redis ZSET)
              </Text>
            </View>
          </View>
        </Card>

        {/* Pinned Current User Card */}
        <Card style={styles.myRankCard}>
          <View style={styles.myRankHeader}>
            <View style={styles.myRankLabelRow}>
              <UserIcon size={16} color={colors.brand.primary} />
              <Text style={styles.myRankHeaderTitle}>Ваша позиция</Text>
            </View>
            {myRank?.rank ? (
              <View style={styles.myRankPill}>
                <Text style={styles.myRankPillText}>#{myRank.rank}</Text>
              </View>
            ) : (
              <View style={[styles.myRankPill, styles.unrankedPill]}>
                <Text style={styles.unrankedPillText}>Вне рейтинга</Text>
              </View>
            )}
          </View>

          <View style={styles.myRankContentRow}>
            <View>
              <Text style={styles.myAthleteName}>
                {user?.username || "Вы (Атлет)"}
              </Text>
              <Text style={styles.myRankSubtext}>
                {myRank?.rank
                  ? `Впереди ${Math.max(0, myRank.rank - 1)} участников`
                  : "Завершите тренировку, чтобы войти в рейтинг"}
              </Text>
            </View>
            <View style={styles.myScoreContainer}>
              <Text style={styles.myScoreValue}>
                {formatWeight(myRank?.score || 0)}
              </Text>
              <Text style={styles.myScoreLabel}>Суммарный объем</Text>
            </View>
          </View>
        </Card>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>
            ТОП АТЛЕТОВ ({totalEntries || entries.length})
          </Text>
          <TouchableOpacity
            onPress={() => loadLeaderboardData(true)}
            style={styles.refreshIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <RefreshCw size={14} color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyComponent = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Trophy size={48} color={colors.border.subtle} />
        <Text style={styles.emptyTitle}>Таблица лидеров пуста</Text>
        <Text style={styles.emptyDescription}>
          Станьте первым атлетом в сезоне — проведите силовую тренировку!
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadLeaderboardData(true)}
        >
          <Text style={styles.retryButtonText}>Обновить</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Лидерборд"
        subtitle="Рейтинг атлетов по тоннажу"
      />

      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={styles.loadingText}>Загрузка рейтинга атлетов...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={colors.status.error} />
            <Text style={styles.errorTitle}>Ошибка загрузки</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadLeaderboardData()}
            >
              <Text style={styles.retryButtonText}>Повторить попытку</Text>
            </TouchableOpacity>
          </Card>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => `${item.rank}-${item.user_id}`}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadLeaderboardData(true)}
              tintColor={colors.brand.primary}
              colors={[colors.brand.primary]}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.darkest,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listHeaderContainer: {
    marginBottom: 8,
  },
  bannerCard: {
    padding: 14,
    marginBottom: 12,
    backgroundColor: "rgba(249, 115, 22, 0.08)",
    borderColor: "rgba(249, 115, 22, 0.25)",
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  trophyIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 16,
  },
  myRankCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
    backgroundColor: "rgba(249, 115, 22, 0.05)",
  },
  myRankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  myRankLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  myRankHeaderTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  myRankPill: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  myRankPillText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13,
  },
  unrankedPill: {
    backgroundColor: colors.bg.elevated,
  },
  unrankedPillText: {
    color: colors.text.muted,
    fontWeight: "600",
    fontSize: 11,
  },
  myRankContentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  myAthleteName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
  },
  myRankSubtext: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  myScoreContainer: {
    alignItems: "flex-end",
  },
  myScoreValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.brand.primary,
  },
  myScoreLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.muted,
    letterSpacing: 1,
  },
  refreshIconBtn: {
    padding: 4,
  },
  entryCard: {
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.bg.card,
  },
  currentAthleteCard: {
    borderColor: colors.brand.primary,
    borderWidth: 1.5,
    backgroundColor: "rgba(249, 115, 22, 0.08)",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankCol: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  medalContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  numericRankContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.dark,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.secondary,
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  athleteName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
    maxWidth: "80%",
  },
  currentAthleteName: {
    color: colors.brand.primary,
    fontWeight: "700",
  },
  youBadge: {
    backgroundColor: "rgba(249, 115, 22, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  youBadgeText: {
    color: colors.brand.primary,
    fontSize: 9,
    fontWeight: "800",
  },
  athleteMeta: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  scoreCol: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  currentScoreValue: {
    color: colors.brand.primary,
    fontWeight: "800",
  },
  scoreUnit: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorContainer: {
    padding: 16,
  },
  errorCard: {
    padding: 24,
    alignItems: "center",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: 12,
  },
  emptyDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
});

export default LeaderboardScreen;
