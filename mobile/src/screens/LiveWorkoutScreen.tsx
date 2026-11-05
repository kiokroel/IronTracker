import {
  Award,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  FastForward,
  Flame,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Timer,
  Trash2,
  Weight,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createWorkoutSession } from "../api/workouts";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Header } from "../components/common/Header";
import { useAuthStore } from "../store/useAuthStore";
import { useLiveWorkoutStore } from "../store/useLiveWorkoutStore";
import { colors } from "../theme/colors";
import type {
  Exercise,
  LiveWorkoutSummary,
  RestPresetSeconds,
  WorkoutSessionCreate,
} from "../types";
import { formatWeight } from "../utils/fitness";
import {
  calculateBestSetOneRepMax,
  calculateTonnage,
  computeLiveWorkoutSummary,
  draftToWorkoutSessionCreate,
  formatTimer,
} from "../utils/liveWorkout";
import { ExerciseCatalogModal } from "./catalog/ExerciseCatalogModal";

const REST_PRESETS: RestPresetSeconds[] = [30, 60, 90, 120, 180];

export const LiveWorkoutScreen: React.FC = () => {
  const { user } = useAuthStore();
  const {
    draft,
    isActive,
    isPaused,
    restTimer,
    summary,
    restoreDraft,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    cancelWorkout,
    finishWorkout,
    clearDraft,
    clearSummary,
    addExercise,
    removeExercise,
    addSet,
    updateSet,
    removeSet,
    completeSet,
    uncompleteSet,
    startRest,
    pauseRest,
    resumeRest,
    addRestTime,
    skipRest,
    tickRest,
    tickElapsed,
  } = useLiveWorkoutStore();

  const [catalogVisible, setCatalogVisible] = useState(false);
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [activeSummary, setActiveSummary] = useState<LiveWorkoutSummary | null>(
    null
  );
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [savingSession, setSavingSession] = useState(false);

  // Restore draft on mount
  useEffect(() => {
    restoreDraft(user?.id);
  }, [user?.id, restoreDraft]);

  // Interval timer for elapsed duration and rest countdown
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const state = useLiveWorkoutStore.getState();
      if (state.isActive && !state.isPaused) {
        state.tickElapsed();
      }
      if (
        state.restTimer &&
        state.restTimer.is_active &&
        !state.restTimer.is_paused
      ) {
        state.tickRest();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  // Handle start workout
  const handleStartWorkout = async () => {
    const defaultTitle = `Силовая тренировка ${new Date().toLocaleDateString(
      "ru-RU"
    )}`;
    await startWorkout(defaultTitle, user?.id);
  };

  // Handle cancel confirmation
  const handleCancelWorkout = () => {
    Alert.alert(
      "Отмена тренировки",
      "Вы уверены, что хотите отменить текущую тренировку? Все несохраненные данные будут удалены.",
      [
        { text: "Продолжить тренировку", style: "cancel" },
        {
          text: "Да, удалить",
          style: "destructive",
          onPress: async () => {
            await cancelWorkout();
          },
        },
      ]
    );
  };

  // Handle finish confirmation
  const handleFinishPrompt = () => {
    if (!draft || draft.exercises.length === 0) {
      Alert.alert(
        "Завершение тренировки",
        "Вы не добавили ни одного упражнения. Все равно завершить?",
        [
          { text: "Назад", style: "cancel" },
          {
            text: "Завершить",
            style: "destructive",
            onPress: async () => {
              const res = await finishWorkout();
              if (res) {
                setActiveSummary(res);
                setFinishModalVisible(true);
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      "Завершить тренировку",
      "Подвести итоги и зафиксировать результаты тренировки?",
      [
        { text: "Продолжить", style: "cancel" },
        {
          text: "Завершить",
          onPress: async () => {
            const res = await finishWorkout();
            if (res) {
              setActiveSummary(res);
              setFinishModalVisible(true);
            }
          },
        },
      ]
    );
  };

  // Handle saving completed session to backend
  const handleSaveToBackend = async () => {
    if (!draft && !activeSummary) return;

    setSavingSession(true);
    try {
      if (!draft) {
        throw new Error("Черновик тренировки не найден");
      }

      // Convert complete draft to WorkoutSessionCreate DTO without any truncation
      const payload: WorkoutSessionCreate = draftToWorkoutSessionCreate(
        draft,
        workoutNotes
      );

      // Send complete session to backend (all sets, exercise_id, exercise_type, RPE, is_warmup, notes, title)
      await createWorkoutSession(payload);

      // Clear draft strictly AFTER successful HTTP 201 Created from backend
      await clearDraft(user?.id || draft.user_id);

      Alert.alert("Успешно!", "Тренировка сохранена в дневнике IronTracker.");
      setFinishModalVisible(false);
      clearSummary();
      setActiveSummary(null);
      setWorkoutNotes("");
    } catch {
      Alert.alert(
        "Ошибка синхронизации",
        "Не удалось сохранить тренировку на сервере. Черновик сохранен локально — вы можете повторить отправку."
      );
    } finally {
      setSavingSession(false);
    }
  };

  // Handle selecting exercise from catalog
  const handleSelectExercise = (exercise: Exercise) => {
    addExercise({
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      target_muscle_groups: exercise.target_muscle_groups,
    });
  };

  // Calculations for active workout view
  const totalSets =
    draft?.exercises.reduce((sum, ex) => sum + ex.sets.length, 0) || 0;
  const completedSets =
    draft?.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.is_completed).length,
      0
    ) || 0;
  const currentTonnage = draft ? calculateTonnage(draft.exercises, false) : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <Header
        title="Live Workout"
        subtitle={
          isActive
            ? isPaused
              ? "Тренировка на паузе"
              : "Активная тренировка"
            : "Интерактивный трекинг в зале"
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!isActive ? (
          <View>
            {draft && (
              <Card style={styles.pendingSyncCard}>
                <View style={styles.pendingSyncHeader}>
                  <Award size={20} color={colors.brand.primary} />
                  <Text style={styles.pendingSyncTitle}>
                    Тренировка ожидает сохранения
                  </Text>
                </View>
                <Text style={styles.pendingSyncDesc}>
                  «{draft.title}» • {draft.exercises.length} упр. •{" "}
                  {draft.exercises.reduce(
                    (sum, e) =>
                      sum + e.sets.filter((s) => s.is_completed).length,
                    0
                  )}{" "}
                  сетов
                </Text>
                <View style={styles.pendingSyncBtnRow}>
                  <Button
                    title="Сохранить в дневник"
                    variant="primary"
                    size="sm"
                    onPress={() => {
                      if (!activeSummary) {
                        setActiveSummary(computeLiveWorkoutSummary(draft));
                      }
                      setFinishModalVisible(true);
                    }}
                  />
                  <Button
                    title="Сбросить"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      Alert.alert(
                        "Удалить черновик?",
                        "Данные завершенной тренировки будут удалены.",
                        [
                          { text: "Отмена", style: "cancel" },
                          {
                            text: "Удалить",
                            style: "destructive",
                            onPress: () =>
                              clearDraft(user?.id || draft.user_id),
                          },
                        ]
                      );
                    }}
                  />
                </View>
              </Card>
            )}

            {/* IDLE / NOT STARTED STATE */}
            <Card style={styles.heroCard}>
              <View style={styles.badgeRow}>
                <View style={styles.idleBadge}>
                  <Flame size={14} color={colors.brand.primary} />
                  <Text style={styles.liveBadgeText}>ГОТОВ К СТАРТУ</Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>Силовая сессия</Text>
              <Text style={styles.cardDescription}>
                Пошаговая запись подходов, индивидуальный вес, таймер отдыха между
                сетами, защита экрана от засыпания (Keep Awake) и синхронизация с
                дневником.
              </Text>

              <View style={styles.featuresRow}>
                <View style={styles.featureItem}>
                  <Timer size={18} color={colors.brand.primary} />
                  <Text style={styles.featureText}>Таймер отдыха</Text>
                </View>
                <View style={styles.featureItem}>
                  <Flame size={18} color={colors.brand.primary} />
                  <Text style={styles.featureText}>Расчет 1RM</Text>
                </View>
                <View style={styles.featureItem}>
                  <Clock size={18} color={colors.brand.primary} />
                  <Text style={styles.featureText}>Keep Awake</Text>
                </View>
              </View>

              <Button
                title="Запустить тренировку"
                variant="primary"
                size="lg"
                onPress={handleStartWorkout}
                icon={<Play size={20} color="#ffffff" />}
              />
            </Card>
          </View>
        ) : (
          /* ACTIVE WORKOUT MODE */
          <View>
            {/* Active Session Header Banner */}
            <Card style={styles.activeBanner}>
              <View style={styles.bannerTopRow}>
                <View
                  style={[
                    styles.statusBadge,
                    isPaused ? styles.pausedBadge : styles.activeBadge,
                  ]}
                >
                  <Flame
                    size={13}
                    color={
                      isPaused ? colors.status.warning : colors.status.success
                    }
                  />
                  <Text
                    style={[
                      styles.statusText,
                      isPaused ? styles.pausedText : styles.activeText,
                    ]}
                  >
                    {isPaused ? "ПАУЗА" : "ТРЕНИРОВКА АКТИВНА"}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleCancelWorkout}
                  style={styles.cancelBtn}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color={colors.status.error} />
                  <Text style={styles.cancelBtnText}>Отмена</Text>
                </TouchableOpacity>
              </View>

              {/* Big Workout Duration Timer */}
              <View style={styles.timerSection}>
                <Text style={styles.timerDisplay}>
                  {formatTimer(draft?.elapsed_seconds || 0)}
                </Text>
                <Text style={styles.timerLabel}>Продолжительность</Text>
              </View>

              {/* Metrics Ribbon */}
              <View style={styles.metricsRibbon}>
                <View style={styles.metricBlock}>
                  <Weight size={15} color={colors.brand.primary} />
                  <Text style={styles.metricValueText}>
                    {formatWeight(currentTonnage)}
                  </Text>
                  <Text style={styles.metricLabelText}>Тоннаж</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBlock}>
                  <CheckCircle2 size={15} color={colors.status.success} />
                  <Text style={styles.metricValueText}>
                    {completedSets} / {totalSets}
                  </Text>
                  <Text style={styles.metricLabelText}>Сеты</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBlock}>
                  <Dumbbell size={15} color={colors.brand.light} />
                  <Text style={styles.metricValueText}>
                    {draft?.exercises.length || 0}
                  </Text>
                  <Text style={styles.metricLabelText}>Упражнений</Text>
                </View>
              </View>

              {/* Workout Controls */}
              <View style={styles.workoutActionsRow}>
                <Button
                  title={isPaused ? "Продолжить" : "Пауза"}
                  variant="secondary"
                  size="sm"
                  onPress={isPaused ? resumeWorkout : pauseWorkout}
                  style={{ flex: 1, marginRight: 8 }}
                  icon={
                    isPaused ? (
                      <Play size={16} color={colors.brand.primary} />
                    ) : (
                      <Pause size={16} color={colors.text.secondary} />
                    )
                  }
                />
                <Button
                  title="Завершить"
                  variant="primary"
                  size="sm"
                  onPress={handleFinishPrompt}
                  style={{ flex: 1.2, marginLeft: 8 }}
                  icon={<Check size={16} color="#ffffff" />}
                />
              </View>
            </Card>

            {/* REST TIMER CARD */}
            {restTimer && restTimer.is_active && (
              <Card style={styles.restCard}>
                <View style={styles.restHeader}>
                  <View style={styles.restHeaderTitleRow}>
                    <Timer size={18} color={colors.brand.primary} />
                    <Text style={styles.restTitle}>Таймер отдыха</Text>
                  </View>
                  <TouchableOpacity
                    onPress={skipRest}
                    style={styles.skipBtn}
                    activeOpacity={0.7}
                  >
                    <SkipForward size={14} color={colors.text.muted} />
                    <Text style={styles.skipText}>Пропустить</Text>
                  </TouchableOpacity>
                </View>

                {/* Rest Countdown Display */}
                <View style={styles.restCountdownWrap}>
                  <Text style={styles.restTime}>
                    {formatTimer(restTimer.remaining_seconds)}
                  </Text>
                  {restTimer.is_paused && (
                    <Text style={styles.restPausedNote}>Отдых на паузе</Text>
                  )}
                </View>

                {/* Rest Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (restTimer.remaining_seconds /
                              Math.max(1, restTimer.total_seconds)) *
                              100
                          )
                        )}%`,
                      },
                    ]}
                  />
                </View>

                {/* Quick Add / Preset Buttons */}
                <View style={styles.restControlsRow}>
                  <TouchableOpacity
                    onPress={() => addRestTime(30)}
                    style={styles.restControlBtn}
                    activeOpacity={0.7}
                  >
                    <FastForward size={14} color={colors.brand.primary} />
                    <Text style={styles.restControlText}>+30 сек</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={restTimer.is_paused ? resumeRest : pauseRest}
                    style={styles.restControlBtn}
                    activeOpacity={0.7}
                  >
                    {restTimer.is_paused ? (
                      <Play size={14} color={colors.status.success} />
                    ) : (
                      <Pause size={14} color={colors.status.warning} />
                    )}
                    <Text style={styles.restControlText}>
                      {restTimer.is_paused ? "Продолжить" : "Пауза"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => startRest(restTimer.total_seconds || 90)}
                    style={styles.restControlBtn}
                    activeOpacity={0.7}
                  >
                    <RotateCcw size={14} color={colors.text.secondary} />
                    <Text style={styles.restControlText}>Сброс</Text>
                  </TouchableOpacity>
                </View>

                {/* Preset Chips */}
                <View style={styles.presetsRow}>
                  {REST_PRESETS.map((seconds) => (
                    <TouchableOpacity
                      key={seconds}
                      onPress={() => startRest(seconds)}
                      style={[
                        styles.presetChip,
                        restTimer.total_seconds === seconds &&
                          styles.activePresetChip,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          restTimer.total_seconds === seconds &&
                            styles.activePresetChipText,
                        ]}
                      >
                        {seconds}с
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            )}

            {/* EXERCISES CONSTRUCTOR */}
            <View style={styles.exercisesSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Упражнения</Text>
                <TouchableOpacity
                  onPress={() => setCatalogVisible(true)}
                  style={styles.addExerciseSmallBtn}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color={colors.brand.primary} />
                  <Text style={styles.addExerciseSmallText}>Добавить</Text>
                </TouchableOpacity>
              </View>

              {draft?.exercises.length === 0 ? (
                <Card style={styles.emptyExercisesCard}>
                  <Dumbbell size={32} color={colors.text.muted} />
                  <Text style={styles.emptyExercisesTitle}>
                    Упражнения еще не добавлены
                  </Text>
                  <Text style={styles.emptyExercisesDesc}>
                    Нажмите «Добавить упражнение», чтобы выбрать движение из
                    каталога и записать первые подходы.
                  </Text>
                  <Button
                    title="Выбрать из каталога"
                    variant="primary"
                    onPress={() => setCatalogVisible(true)}
                    style={{ marginTop: 14 }}
                    icon={<Plus size={16} color="#ffffff" />}
                  />
                </Card>
              ) : (
                draft?.exercises.map((exercise, exIndex) => {
                  const bestSet = calculateBestSetOneRepMax(exercise);

                  return (
                    <Card key={exercise.id} style={styles.exerciseCard}>
                      {/* Exercise Header */}
                      <View style={styles.exerciseHeader}>
                        <View style={styles.exerciseTitleCol}>
                          <Text style={styles.exerciseNameText}>
                            {exIndex + 1}. {exercise.exercise_name}
                          </Text>
                          <View style={styles.exerciseBadgesRow}>
                            {exercise.target_muscle_groups &&
                              exercise.target_muscle_groups.length > 0 && (
                                <View style={styles.muscleBadge}>
                                  <Text style={styles.muscleBadgeText}>
                                    {exercise.target_muscle_groups.join(", ")}
                                  </Text>
                                </View>
                              )}
                            {bestSet && (
                              <View style={styles.oneRmBadge}>
                                <Award size={12} color={colors.brand.primary} />
                                <Text style={styles.oneRmText}>
                                  1RM ~ {bestSet.estimated_one_rep_max} кг
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              "Удалить упражнение",
                              `Удалить «${exercise.exercise_name}» и все его подходы?`,
                              [
                                { text: "Отмена", style: "cancel" },
                                {
                                  text: "Удалить",
                                  style: "destructive",
                                  onPress: () => removeExercise(exercise.id),
                                },
                              ]
                            );
                          }}
                          style={styles.deleteExBtn}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={16} color={colors.text.muted} />
                        </TouchableOpacity>
                      </View>

                      {/* Sets Table Header */}
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.colHeader, styles.colSet]}>СЕТ</Text>
                        <Text style={[styles.colHeader, styles.colWeight]}>
                          ВЕС (КГ)
                        </Text>
                        <Text style={[styles.colHeader, styles.colReps]}>
                          ПОВТ
                        </Text>
                        <Text style={[styles.colHeader, styles.colRpe]}>RPE</Text>
                        <Text style={[styles.colHeader, styles.colWarmup]}>
                          РАЗМ
                        </Text>
                        <Text style={[styles.colHeader, styles.colDone]}>
                          ГОТОВО
                        </Text>
                        <Text style={[styles.colHeader, styles.colAction]} />
                      </View>

                      {/* Sets Rows */}
                      {exercise.sets.map((set) => {
                        const isSetDone = set.is_completed;

                        return (
                          <View
                            key={set.id}
                            style={[
                              styles.setTableRow,
                              isSetDone && styles.setTableRowCompleted,
                            ]}
                          >
                            {/* Set Number */}
                            <View style={styles.colSet}>
                              <View
                                style={[
                                  styles.setNumberCircle,
                                  set.is_warmup && styles.setWarmupCircle,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.setNumberText,
                                    set.is_warmup && styles.setWarmupNumberText,
                                  ]}
                                >
                                  {set.set_number}
                                </Text>
                              </View>
                            </View>

                            {/* Weight Input */}
                            <View style={styles.colWeight}>
                              <TextInput
                                style={[
                                  styles.setInput,
                                  isSetDone && styles.setInputDone,
                                ]}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={colors.text.muted}
                                value={set.weight ? String(set.weight) : ""}
                                onChangeText={(val) => {
                                  const num = parseFloat(val) || 0;
                                  updateSet(exercise.id, set.id, { weight: num });
                                }}
                              />
                            </View>

                            {/* Reps Input */}
                            <View style={styles.colReps}>
                              <TextInput
                                style={[
                                  styles.setInput,
                                  isSetDone && styles.setInputDone,
                                ]}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor={colors.text.muted}
                                value={set.reps ? String(set.reps) : ""}
                                onChangeText={(val) => {
                                  const num = parseInt(val, 10) || 0;
                                  updateSet(exercise.id, set.id, { reps: num });
                                }}
                              />
                            </View>

                            {/* RPE Input */}
                            <View style={styles.colRpe}>
                              <TextInput
                                style={[
                                  styles.setInput,
                                  styles.rpeInput,
                                  isSetDone && styles.setInputDone,
                                ]}
                                keyboardType="numeric"
                                placeholder="-"
                                placeholderTextColor={colors.text.muted}
                                value={
                                  set.rpe !== null && set.rpe !== undefined
                                    ? String(set.rpe)
                                    : ""
                                }
                                onChangeText={(val) => {
                                  const num = parseFloat(val);
                                  updateSet(exercise.id, set.id, {
                                    rpe: isNaN(num) ? null : num,
                                  });
                                }}
                              />
                            </View>

                            {/* Warmup Toggle */}
                            <TouchableOpacity
                              onPress={() =>
                                updateSet(exercise.id, set.id, {
                                  is_warmup: !set.is_warmup,
                                })
                              }
                              style={[
                                styles.warmupToggle,
                                set.is_warmup && styles.warmupToggleActive,
                              ]}
                              activeOpacity={0.7}
                            >
                              <Flame
                                size={14}
                                color={
                                  set.is_warmup
                                    ? colors.status.warning
                                    : colors.text.muted
                                }
                              />
                            </TouchableOpacity>

                            {/* Done / Complete Button */}
                            <TouchableOpacity
                              onPress={() => {
                                if (isSetDone) {
                                  uncompleteSet(exercise.id, set.id);
                                } else {
                                  completeSet(exercise.id, set.id, 90);
                                }
                              }}
                              style={[
                                styles.checkBtn,
                                isSetDone && styles.checkBtnDone,
                              ]}
                              activeOpacity={0.7}
                            >
                              <Check
                                size={15}
                                color={isSetDone ? "#ffffff" : colors.text.muted}
                              />
                            </TouchableOpacity>

                            {/* Delete Set */}
                            <TouchableOpacity
                              onPress={() => removeSet(exercise.id, set.id)}
                              style={styles.colAction}
                              activeOpacity={0.7}
                            >
                              <X size={14} color={colors.text.muted} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}

                      {/* Add Set Button */}
                      <TouchableOpacity
                        onPress={() => addSet(exercise.id)}
                        style={styles.addSetBtn}
                        activeOpacity={0.7}
                      >
                        <Plus size={15} color={colors.brand.primary} />
                        <Text style={styles.addSetText}>Добавить подход</Text>
                      </TouchableOpacity>
                    </Card>
                  );
                })
              )}

              {/* Add Exercise Floating / Bottom Button */}
              {draft && draft.exercises.length > 0 && (
                <Button
                  title="Добавить упражнение"
                  variant="secondary"
                  onPress={() => setCatalogVisible(true)}
                  style={styles.addExerciseBottomBtn}
                  icon={<Plus size={18} color={colors.brand.primary} />}
                />
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* EXERCISE CATALOG MODAL */}
      <ExerciseCatalogModal
        visible={catalogVisible}
        onClose={() => setCatalogVisible(false)}
        onSelectExercise={handleSelectExercise}
      />

      {/* WORKOUT SUMMARY FINISH MODAL */}
      <Modal
        visible={finishModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFinishModalVisible(false)}
      >
        <View style={styles.summaryContainer}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryTitleRow}>
              <Award size={24} color={colors.brand.primary} />
              <Text style={styles.summaryHeaderTitle}>Итоги тренировки</Text>
            </View>
            <TouchableOpacity
              onPress={() => setFinishModalVisible(false)}
              style={styles.closeBtn}
            >
              <X size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.summaryContent}
            showsVerticalScrollIndicator={false}
          >
            {activeSummary && (
              <View>
                {/* Stats Grid */}
                <View style={styles.summaryGrid}>
                  <Card style={styles.summaryCard}>
                    <Clock size={20} color={colors.brand.primary} />
                    <Text style={styles.summaryMetricVal}>
                      {activeSummary.duration_minutes} мин
                    </Text>
                    <Text style={styles.summaryMetricLabel}>
                      Время ({formatTimer(activeSummary.duration_seconds)})
                    </Text>
                  </Card>

                  <Card style={styles.summaryCard}>
                    <Weight size={20} color={colors.brand.primary} />
                    <Text style={styles.summaryMetricVal}>
                      {formatWeight(activeSummary.total_tonnage)}
                    </Text>
                    <Text style={styles.summaryMetricLabel}>Общий тоннаж</Text>
                  </Card>

                  <Card style={styles.summaryCard}>
                    <CheckCircle2 size={20} color={colors.status.success} />
                    <Text style={styles.summaryMetricVal}>
                      {activeSummary.completed_sets} / {activeSummary.total_sets}
                    </Text>
                    <Text style={styles.summaryMetricLabel}>
                      Завершено сетов
                    </Text>
                  </Card>

                  <Card style={styles.summaryCard}>
                    <Dumbbell size={20} color={colors.brand.light} />
                    <Text style={styles.summaryMetricVal}>
                      {activeSummary.exercises_count}
                    </Text>
                    <Text style={styles.summaryMetricLabel}>Упражнений</Text>
                  </Card>
                </View>

                {/* Best Sets & 1RM List */}
                {activeSummary.best_sets.length > 0 && (
                  <View style={styles.bestSetsSection}>
                    <Text style={styles.bestSetsTitle}>
                      Лучшие подходы и расчетный 1RM
                    </Text>
                    {activeSummary.best_sets.map((best, idx) => (
                      <Card key={idx} style={styles.bestSetCard}>
                        <View style={styles.bestSetHeader}>
                          <Text style={styles.bestSetExName}>
                            {best.exercise_name}
                          </Text>
                          <View style={styles.oneRmResultBadge}>
                            <Flame size={12} color={colors.brand.primary} />
                            <Text style={styles.oneRmResultText}>
                              1RM: {best.estimated_one_rep_max} кг
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.bestSetSub}>
                          Лучший сет: {best.weight} кг × {best.reps} повт.
                        </Text>
                      </Card>
                    ))}
                  </View>
                )}

                {/* Notes Input */}
                <Text style={styles.notesLabel}>Заметки о самочувствии</Text>
                <TextInput
                  placeholder="Отличный памп, легко дался жим, добавить вес в следующий раз..."
                  placeholderTextColor={colors.text.muted}
                  value={workoutNotes}
                  onChangeText={setWorkoutNotes}
                  multiline
                  numberOfLines={3}
                  style={styles.notesInput}
                />
              </View>
            )}
          </ScrollView>

          {/* Modal Footer */}
          <View style={styles.summaryFooter}>
            <Button
              title="Сохранить в дневник"
              variant="primary"
              size="lg"
              loading={savingSession}
              onPress={handleSaveToBackend}
              icon={<Check size={20} color="#ffffff" />}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  heroCard: {
    padding: 20,
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  idleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand.primary,
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  featuresRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
    marginLeft: 6,
  },

  // Active workout styles
  activeBanner: {
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.active,
  },
  bannerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  pausedBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  activeText: {
    color: colors.status.success,
  },
  pausedText: {
    color: colors.status.warning,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelBtnText: {
    color: colors.status.error,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  timerSection: {
    alignItems: "center",
    marginVertical: 10,
  },
  timerDisplay: {
    fontSize: 40,
    fontWeight: "800",
    color: colors.text.primary,
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
  timerLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricsRibbon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 12,
  },
  metricBlock: {
    alignItems: "center",
    flex: 1,
  },
  metricValueText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: 4,
  },
  metricLabelText: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border.subtle,
  },
  workoutActionsRow: {
    flexDirection: "row",
    marginTop: 8,
  },

  // Rest Timer Card
  restCard: {
    padding: 16,
    marginBottom: 14,
    backgroundColor: colors.bg.card,
    borderColor: colors.brand.primary,
    borderWidth: 1.5,
  },
  restHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  restHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  restTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brand.primary,
    marginLeft: 6,
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
  },
  skipText: {
    fontSize: 12,
    color: colors.text.muted,
    marginLeft: 4,
  },
  restCountdownWrap: {
    alignItems: "center",
    marginVertical: 8,
  },
  restTime: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.text.primary,
    fontVariant: ["tabular-nums"],
  },
  restPausedNote: {
    fontSize: 12,
    color: colors.status.warning,
    fontWeight: "600",
    marginTop: 2,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.bg.darkest,
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.brand.primary,
    borderRadius: 3,
  },
  restControlsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 4,
    marginBottom: 10,
  },
  restControlBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.dark,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  restControlText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.primary,
    marginLeft: 6,
  },
  presetsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  presetChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.bg.dark,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  activePresetChip: {
    backgroundColor: "rgba(249, 115, 22, 0.2)",
    borderColor: colors.brand.primary,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  activePresetChipText: {
    color: colors.brand.primary,
  },

  // Exercises Section
  exercisesSection: {
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.primary,
  },
  addExerciseSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  addExerciseSmallText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand.primary,
    marginLeft: 4,
  },
  emptyExercisesCard: {
    alignItems: "center",
    padding: 28,
  },
  emptyExercisesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: 10,
  },
  emptyExercisesDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  exerciseCard: {
    padding: 14,
    marginVertical: 6,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  exerciseTitleCol: {
    flex: 1,
  },
  exerciseNameText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  exerciseBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  muscleBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  muscleBadgeText: {
    fontSize: 11,
    color: colors.text.secondary,
    textTransform: "capitalize",
  },
  oneRmBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  oneRmText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand.primary,
  },
  deleteExBtn: {
    padding: 4,
  },

  // Sets Table
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: 4,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.text.muted,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  colSet: {
    width: 32,
    alignItems: "center",
  },
  colWeight: {
    flex: 2,
    paddingHorizontal: 4,
  },
  colReps: {
    flex: 1.8,
    paddingHorizontal: 4,
  },
  colRpe: {
    flex: 1.5,
    paddingHorizontal: 4,
  },
  colWarmup: {
    width: 38,
    alignItems: "center",
  },
  colDone: {
    width: 44,
    alignItems: "center",
  },
  colAction: {
    width: 28,
    alignItems: "center",
  },

  setTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.03)",
  },
  setTableRowCompleted: {
    backgroundColor: "rgba(34, 197, 94, 0.06)",
    borderRadius: 8,
  },
  setNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg.card,
    alignItems: "center",
    justifyContent: "center",
  },
  setNumberText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text.secondary,
  },
  setWarmupCircle: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
  },
  setWarmupNumberText: {
    color: colors.status.warning,
  },
  setInput: {
    backgroundColor: colors.bg.darkest,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  rpeInput: {
    fontSize: 13,
  },
  setInputDone: {
    borderColor: colors.status.success,
  },
  warmupToggle: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.darkest,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  warmupToggleActive: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderColor: colors.status.warning,
  },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.darkest,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
  },
  checkBtnDone: {
    backgroundColor: colors.status.success,
    borderColor: colors.status.success,
  },
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: "rgba(249, 115, 22, 0.08)",
  },
  addSetText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand.primary,
    marginLeft: 6,
  },
  addExerciseBottomBtn: {
    marginTop: 12,
    marginBottom: 20,
  },

  // Summary Modal styles
  summaryContainer: {
    flex: 1,
    backgroundColor: colors.bg.darkest,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  summaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text.primary,
    marginLeft: 10,
  },
  closeBtn: {
    padding: 4,
  },
  summaryContent: {
    padding: 20,
    paddingBottom: 100,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    width: "48%",
    alignItems: "center",
    padding: 16,
  },
  summaryMetricVal: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.primary,
    marginTop: 8,
  },
  summaryMetricLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
    textAlign: "center",
  },
  bestSetsSection: {
    marginBottom: 20,
  },
  bestSetsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 10,
  },
  bestSetCard: {
    padding: 12,
    marginVertical: 4,
  },
  bestSetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  bestSetExName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    flex: 1,
  },
  oneRmResultBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  oneRmResultText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand.primary,
  },
  bestSetSub: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    padding: 12,
    color: colors.text.primary,
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  pendingSyncCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    backgroundColor: "rgba(249, 115, 22, 0.08)",
  },
  pendingSyncHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  pendingSyncTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  pendingSyncDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  pendingSyncBtnRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  summaryFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.bg.darkest,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});
