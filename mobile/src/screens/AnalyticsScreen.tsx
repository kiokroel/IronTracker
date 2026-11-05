import {
  AlertCircle,
  BarChart3,
  Calculator,
  Calendar,
  ChevronRight,
  Dumbbell,
  Flame,
  LineChart,
  RefreshCw,
  Trophy,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { fetchWorkoutSessions } from "../api/workouts";
import {
  LineProgressionChart,
  VolumeBarChart,
} from "../components/analytics";
import { Card } from "../components/common/Card";
import { Header } from "../components/common/Header";
import { colors } from "../theme/colors";
import type { WorkoutSessionResponse } from "../types";
import {
  calculatePersonalRecords,
  extractOneRepMaxHistory,
  extractVolumeTrend,
  formatDateShort,
  getAvailableExerciseNames,
  isExerciseMatch,
} from "../utils/analytics";
import { formatWeight } from "../utils/fitness";

const DEFAULT_EXERCISES = [
  "Жим штанги лежа",
  "Приседания со штангой",
  "Становая тяга",
  "Армейский жим стоя",
];

export const AnalyticsScreen: React.FC = () => {
  const [sessions, setSessions] = useState<WorkoutSessionResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>("Жим штанги лежа");

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await fetchWorkoutSessions(0, 100);
      setSessions(data || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Не удалось загрузить тренировки";
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Combined list of exercise filters: defaults + any discovered from session history
  const exerciseFilters = useMemo(() => {
    const fromHistory = getAvailableExerciseNames(sessions);
    const set = new Set<string>([...DEFAULT_EXERCISES, ...fromHistory]);
    return Array.from(set);
  }, [sessions]);

  // Auto-align selected exercise with history when sessions load
  useEffect(() => {
    const history = getAvailableExerciseNames(sessions);
    if (history.length > 0) {
      const hasDirectHistory = history.includes(selectedExercise);
      if (!hasDirectHistory) {
        const matchingHistory = history.find((h) => isExerciseMatch(h, selectedExercise));
        if (matchingHistory) {
          setSelectedExercise(matchingHistory);
        } else {
          setSelectedExercise(history[0]);
        }
      }
    }
  }, [sessions]);

  // 1RM progression data for currently selected exercise
  const oneRepMaxPoints = useMemo(() => {
    return extractOneRepMaxHistory(sessions, selectedExercise);
  }, [sessions, selectedExercise]);

  // Volume trend data across all workouts
  const volumeTrend = useMemo(() => {
    return extractVolumeTrend(sessions);
  }, [sessions]);

  // Career personal records summary
  const prSummary = useMemo(() => {
    return calculatePersonalRecords(sessions);
  }, [sessions]);

  // Peak set for scientific formula comparison card
  const peakPoint = useMemo(() => {
    if (oneRepMaxPoints.length === 0) return null;
    return [...oneRepMaxPoints].sort((a, b) => b.oneRepMax - a.oneRepMax)[0];
  }, [oneRepMaxPoints]);

  return (
    <View style={styles.screen}>
      <Header
        title="Аналитика и 1RM"
        subtitle="Прогрессия силы и объемы нагрузок"
      />

      {isLoading && !isRefreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={styles.loadingText}>Анализ истории тренировок...</Text>
        </View>
      ) : error ? (
        <View style={styles.contentPadding}>
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={colors.status.error} />
            <Text style={styles.errorTitle}>Ошибка загрузки аналитики</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadData()}
            >
              <Text style={styles.retryButtonText}>Повторить попытку</Text>
            </TouchableOpacity>
          </Card>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadData(true)}
              tintColor={colors.brand.primary}
              colors={[colors.brand.primary]}
            />
          }
        >
          {sessions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Dumbbell size={48} color={colors.border.subtle} />
              <Text style={styles.emptyTitle}>История тренировок пуста</Text>
              <Text style={styles.emptyDescription}>
                Завершите вашу первую силовую тренировку, чтобы активировать
                графики 1RM, динамику тоннажа и личные рекорды.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => loadData(true)}
              >
                <Text style={styles.retryButtonText}>Проверить снова</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <>
              {/* Exercise Selector Chips */}
              <View style={styles.selectorSection}>
                <Text style={styles.sectionLabel}>ВЫБОР УПРАЖНЕНИЯ</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScroll}
                >
                  {exerciseFilters.map((exName) => {
                    const isSelected = selectedExercise === exName;
                    return (
                      <TouchableOpacity
                        key={exName}
                        style={[
                          styles.chip,
                          isSelected && styles.chipActive,
                        ]}
                        onPress={() => setSelectedExercise(exName)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextActive,
                          ]}
                        >
                          {exName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 1RM Progression SVG Chart */}
              <LineProgressionChart
                data={oneRepMaxPoints}
                title={`Динамика 1RM: ${selectedExercise}`}
                unit="kg"
                color={colors.brand.primary}
                height={210}
              />

              {/* Formula Breakdown Card (Epley, Brzycki, Lander, Wathan) */}
              {peakPoint && (
                <Card style={styles.formulaCard}>
                  <View style={styles.formulaHeader}>
                    <View style={styles.formulaTitleRow}>
                      <Calculator size={18} color={colors.brand.primary} />
                      <Text style={styles.formulaTitle}>
                        Сравнение формул 1RM
                      </Text>
                    </View>
                    <Text style={styles.formulaSetLabel}>
                      {peakPoint.weight} kg × {peakPoint.reps} повт.
                    </Text>
                  </View>

                  <Text style={styles.formulaSubtitle}>
                    Научные методики прогнозирования одноповторного максимума
                  </Text>

                  <View style={styles.formulaGrid}>
                    <View style={styles.formulaItem}>
                      <Text style={styles.formulaItemName}>Эпли (Epley)</Text>
                      <Text style={styles.formulaItemValue}>
                        {peakPoint.formulaBreakdown.epley} kg
                      </Text>
                    </View>

                    <View style={styles.formulaItem}>
                      <Text style={styles.formulaItemName}>Бжицки (Brzycki)</Text>
                      <Text style={styles.formulaItemValue}>
                        {peakPoint.formulaBreakdown.brzycki} kg
                      </Text>
                    </View>

                    <View style={styles.formulaItem}>
                      <Text style={styles.formulaItemName}>Ландер (Lander)</Text>
                      <Text style={styles.formulaItemValue}>
                        {peakPoint.formulaBreakdown.lander} kg
                      </Text>
                    </View>

                    <View style={styles.formulaItem}>
                      <Text style={styles.formulaItemName}>Ватан (Wathan)</Text>
                      <Text style={styles.formulaItemValue}>
                        {peakPoint.formulaBreakdown.wathan} kg
                      </Text>
                    </View>
                  </View>

                  <View style={styles.averageRow}>
                    <Text style={styles.averageLabel}>
                      Консенсус (среднее значение):
                    </Text>
                    <Text style={styles.averageValue}>
                      {peakPoint.formulaBreakdown.average} kg
                    </Text>
                  </View>
                </Card>
              )}

              {/* Volume Trend SVG Bar Chart */}
              <VolumeBarChart
                data={volumeTrend}
                title="Объем тоннажа по тренировкам"
                color={colors.brand.primary}
                height={210}
                maxBars={8}
              />

              {/* Career Personal Records (PR Grid) */}
              <View style={styles.prSectionHeader}>
                <Trophy size={18} color={colors.brand.primary} />
                <Text style={styles.prSectionTitle}>ЛИЧНЫЕ РЕКОРДЫ (PR)</Text>
              </View>

              <View style={styles.prGrid}>
                {/* Best 1RM */}
                <Card style={styles.prCard}>
                  <View style={styles.prCardHeader}>
                    <Zap size={16} color="#eab308" />
                    <Text style={styles.prCardType}>Лучший 1RM</Text>
                  </View>
                  {prSummary.bestOneRepMax ? (
                    <>
                      <Text style={styles.prValue}>
                        {prSummary.bestOneRepMax.oneRepMax} kg
                      </Text>
                      <Text style={styles.prExerciseName} numberOfLines={1}>
                        {prSummary.bestOneRepMax.exerciseName}
                      </Text>
                      <Text style={styles.prMeta}>
                        {prSummary.bestOneRepMax.weight} kg ×{" "}
                        {prSummary.bestOneRepMax.reps} (
                        {formatDateShort(prSummary.bestOneRepMax.date)})
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.prEmpty}>Нет данных</Text>
                  )}
                </Card>

                {/* Heaviest Weight */}
                <Card style={styles.prCard}>
                  <View style={styles.prCardHeader}>
                    <Dumbbell size={16} color={colors.brand.primary} />
                    <Text style={styles.prCardType}>Макс. вес снаряда</Text>
                  </View>
                  {prSummary.maxWeightLifted ? (
                    <>
                      <Text style={styles.prValue}>
                        {prSummary.maxWeightLifted.weight} kg
                      </Text>
                      <Text style={styles.prExerciseName} numberOfLines={1}>
                        {prSummary.maxWeightLifted.exerciseName}
                      </Text>
                      <Text style={styles.prMeta}>
                        {prSummary.maxWeightLifted.reps} повт. (
                        {formatDateShort(prSummary.maxWeightLifted.date)})
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.prEmpty}>Нет данных</Text>
                  )}
                </Card>

                {/* Best Session Tonnage */}
                <Card style={styles.prCard}>
                  <View style={styles.prCardHeader}>
                    <Flame size={16} color="#ef4444" />
                    <Text style={styles.prCardType}>Рекорд сессии</Text>
                  </View>
                  {prSummary.maxSessionTonnage ? (
                    <>
                      <Text style={styles.prValue}>
                        {formatWeight(prSummary.maxSessionTonnage.tonnage)}
                      </Text>
                      <Text style={styles.prExerciseName} numberOfLines={1}>
                        {prSummary.maxSessionTonnage.title}
                      </Text>
                      <Text style={styles.prMeta}>
                        {formatDateShort(prSummary.maxSessionTonnage.date)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.prEmpty}>Нет данных</Text>
                  )}
                </Card>

                {/* Total Career Volume */}
                <Card style={styles.prCard}>
                  <View style={styles.prCardHeader}>
                    <BarChart3 size={16} color={colors.status.success} />
                    <Text style={styles.prCardType}>Всего тоннажа</Text>
                  </View>
                  <Text style={styles.prValue}>
                    {formatWeight(prSummary.totalAllTimeTonnage)}
                  </Text>
                  <Text style={styles.prExerciseName}>
                    {prSummary.totalSessionsCount} тренировок
                  </Text>
                  <Text style={styles.prMeta}>
                    {prSummary.totalWorkingSetsCount} рабочих подходов
                  </Text>
                </Card>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.darkest,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  contentPadding: {
    padding: 16,
  },
  centerContainer: {
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
  selectorSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  chipsScroll: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  chipActive: {
    borderColor: colors.brand.primary,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: colors.brand.primary,
    fontWeight: "700",
  },
  formulaCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  formulaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  formulaTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  formulaTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  formulaSetLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand.primary,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  formulaSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
    marginBottom: 12,
  },
  formulaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  formulaItem: {
    flex: 0.48,
    backgroundColor: colors.bg.dark,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  formulaItemName: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  formulaItemValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text.primary,
    marginTop: 2,
  },
  averageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  averageLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  averageValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brand.primary,
  },
  prSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
    marginLeft: 4,
  },
  prSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.muted,
    letterSpacing: 1,
  },
  prGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  prCard: {
    width: "48%",
    padding: 12,
    backgroundColor: colors.bg.card,
    marginVertical: 0,
  },
  prCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  prCardType: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  prValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 2,
  },
  prExerciseName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  prMeta: {
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 2,
  },
  prEmpty: {
    fontSize: 12,
    color: colors.text.muted,
    fontStyle: "italic",
    marginTop: 4,
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
    backgroundColor: colors.bg.card,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
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
});

export default AnalyticsScreen;
