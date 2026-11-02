import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Flame,
  Plus,
  Weight,
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
import { fetchWorkoutSessions } from "../api/workouts";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Header } from "../components/common/Header";
import { colors } from "../theme/colors";
import type { WorkoutSessionResponse } from "../types";
import { formatWeight } from "../utils/fitness";
import { ExerciseCatalogModal } from "./catalog/ExerciseCatalogModal";

export const WorkoutsScreen: React.FC = () => {
  const [sessions, setSessions] = useState<WorkoutSessionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(
    new Set()
  );
  const [catalogVisible, setCatalogVisible] = useState(false);

  const loadSessions = async () => {
    try {
      const data = await fetchWorkoutSessions();
      setSessions(data);
    } catch {
      // Fallback demo data if offline / backend not running
      if (sessions.length === 0) {
        setSessions([
          {
            id: "demo-session-1",
            user_id: "demo-user",
            title: "Грудь и Трицепс (Силовой день)",
            date: new Date().toISOString(),
            duration_minutes: 65,
            total_tonnage: 8450,
            notes: "Отличный темп, жим пошел легко",
            exercises: [
              {
                exercise_name: "Жим штанги лежа",
                exercise_type: "strength",
                sets: [
                  { set_number: 1, weight: 60, reps: 10, is_warmup: true },
                  { set_number: 2, weight: 100, reps: 5, rpe: 8, is_warmup: false },
                  { set_number: 3, weight: 100, reps: 5, rpe: 8.5, is_warmup: false },
                  { set_number: 4, weight: 105, reps: 4, rpe: 9, is_warmup: false },
                ],
              },
              {
                exercise_name: "Жим гантелей на наклонной",
                exercise_type: "strength",
                sets: [
                  { set_number: 1, weight: 32, reps: 8, rpe: 8, is_warmup: false },
                  { set_number: 2, weight: 32, reps: 8, rpe: 8.5, is_warmup: false },
                ],
              },
            ],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    loadSessions().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "Недавно";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Недавно";
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Дневник тренировок"
        subtitle="История и анализ завершенных сессий"
        rightAction={
          <TouchableOpacity
            onPress={() => setCatalogVisible(true)}
            style={styles.catalogButton}
            activeOpacity={0.7}
          >
            <BookOpen size={18} color={colors.brand.primary} />
            <Text style={styles.catalogButtonText}>Каталог</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={styles.loaderText}>Загрузка тренировок...</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.primary}
              colors={[colors.brand.primary]}
            />
          }
          renderItem={({ item }) => {
            const isExpanded = expandedSessionIds.has(item.id);
            const totalSets = item.exercises.reduce(
              (sum, ex) => sum + (ex.sets?.length || 0),
              0
            );

            return (
              <Card style={styles.sessionCard}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => toggleExpand(item.id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.titleCol}>
                      <Text style={styles.sessionTitle}>
                        {item.title || "Силовая сессия"}
                      </Text>
                      <View style={styles.dateRow}>
                        <Calendar size={13} color={colors.text.muted} />
                        <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                      </View>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={20} color={colors.text.secondary} />
                    ) : (
                      <ChevronDown size={20} color={colors.text.secondary} />
                    )}
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <Weight size={15} color={colors.brand.primary} />
                      <Text style={styles.metricLabel}>Тоннаж:</Text>
                      <Text style={styles.metricValue}>
                        {formatWeight(item.total_tonnage)}
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Clock size={15} color={colors.text.secondary} />
                      <Text style={styles.metricLabel}>Время:</Text>
                      <Text style={styles.metricValue}>
                        {item.duration_minutes ? `${item.duration_minutes} мин` : "—"}
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Dumbbell size={15} color={colors.text.secondary} />
                      <Text style={styles.metricLabel}>Сеты:</Text>
                      <Text style={styles.metricValue}>{totalSets}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.divider} />
                    {item.exercises.map((exercise, idx) => (
                      <View key={idx} style={styles.exerciseBlock}>
                        <View style={styles.exerciseHeader}>
                          <Flame size={15} color={colors.brand.primary} />
                          <Text style={styles.exerciseName}>
                            {exercise.exercise_name}
                          </Text>
                        </View>

                        <View style={styles.setsTable}>
                          {exercise.sets.map((set, sIdx) => (
                            <View key={sIdx} style={styles.setRow}>
                              <View style={styles.setNumBadge}>
                                <Text style={styles.setNumText}>
                                  #{set.set_number}
                                </Text>
                              </View>
                              <Text style={styles.setText}>
                                {set.weight} кг × {set.reps} повт.
                              </Text>
                              {set.rpe && (
                                <Text style={styles.rpeText}>
                                  RPE {set.rpe}
                                </Text>
                              )}
                              {set.is_warmup && (
                                <View style={styles.warmupBadge}>
                                  <Text style={styles.warmupText}>Разминка</Text>
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}

                    {item.notes && (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesText}>💬 {item.notes}</Text>
                      </View>
                    )}
                  </View>
                )}
              </Card>
            );
          }}
          ListEmptyComponent={
            <Card>
              <View style={styles.emptyState}>
                <Dumbbell size={36} color={colors.brand.primary} />
                <Text style={styles.emptyTitle}>Тренировок пока нет</Text>
                <Text style={styles.emptySubtitle}>
                  Проведите тренировку в режиме Live или откройте каталог упражнений
                </Text>
                <Button
                  title="Открыть каталог"
                  variant="secondary"
                  onPress={() => setCatalogVisible(true)}
                  style={{ marginTop: 16, width: "100%" }}
                  icon={<BookOpen size={16} color={colors.text.primary} />}
                />
              </View>
            </Card>
          }
        />
      )}

      {/* Exercise Catalog Modal */}
      <ExerciseCatalogModal
        visible={catalogVisible}
        onClose={() => setCatalogVisible(false)}
      />
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
  catalogButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  catalogButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand.primary,
    marginLeft: 6,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderText: {
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 10,
  },
  sessionCard: {
    marginVertical: 6,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleCol: {
    flex: 1,
    marginRight: 8,
  },
  sessionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 6,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.bg.darkest,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginLeft: 4,
    marginRight: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.primary,
  },
  expandedContent: {
    marginTop: 14,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginBottom: 12,
  },
  exerciseBlock: {
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    marginLeft: 6,
  },
  setsTable: {
    backgroundColor: colors.bg.card,
    borderRadius: 8,
    padding: 8,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  setNumBadge: {
    width: 28,
    paddingVertical: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 4,
    alignItems: "center",
    marginRight: 10,
  },
  setNumText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  setText: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: "600",
    flex: 1,
  },
  rpeText: {
    fontSize: 11,
    color: colors.brand.primary,
    fontWeight: "600",
    marginRight: 8,
  },
  warmupBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warmupText: {
    fontSize: 10,
    color: colors.status.warning,
    fontWeight: "600",
  },
  notesBox: {
    marginTop: 6,
    padding: 8,
    backgroundColor: colors.bg.darkest,
    borderRadius: 6,
  },
  notesText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 4,
  },
});
