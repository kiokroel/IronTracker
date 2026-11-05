import {
  Calendar,
  Check,
  Clock,
  Dumbbell,
  Flame,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createWorkoutSession } from "../../api/workouts";
import { ExerciseCatalogModal } from "../../screens/catalog/ExerciseCatalogModal";
import { checkConnection } from "../../services/network";
import { enqueueWorkoutSession } from "../../services/syncQueue";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";
import type {
  Exercise,
  ExerciseCategory,
  WorkoutSessionCreate,
  WorkoutSessionExerciseItem,
} from "../../types";
import { formatWeight } from "../../utils/fitness";
import { Button } from "../common/Button";
import { Card } from "../common/Card";

interface ManualSetItem {
  id: string;
  weight: string;
  reps: string;
  rpe: string;
  is_warmup: boolean;
}

interface ManualExerciseItem {
  id: string;
  exercise_id?: string | null;
  exercise_name: string;
  exercise_type: ExerciseCategory;
  sets: ManualSetItem[];
}

interface ManualWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManualWorkoutModal: React.FC<ManualWorkoutModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuthStore();

  const [title, setTitle] = useState("Силовая тренировка");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ManualExerciseItem[]>([]);
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddExerciseFromCatalog = (ex: Exercise) => {
    const newExercise: ManualExerciseItem = {
      id: `manual-ex-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      exercise_id: ex.id,
      exercise_name: ex.name,
      exercise_type: ex.category || "strength",
      sets: [
        {
          id: `set-1-${Date.now()}`,
          weight: "60",
          reps: "10",
          rpe: "8",
          is_warmup: false,
        },
      ],
    };
    setExercises((prev) => [...prev, newExercise]);
    setCatalogVisible(false);
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  };

  const handleAddSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: ManualSetItem = {
          id: `set-${ex.sets.length + 1}-${Date.now()}`,
          weight: lastSet ? lastSet.weight : "60",
          reps: lastSet ? lastSet.reps : "10",
          rpe: lastSet ? lastSet.rpe : "8",
          is_warmup: false,
        };
        return {
          ...ex,
          sets: [...ex.sets, newSet],
        };
      })
    );
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const remaining = ex.sets.filter((s) => s.id !== setId);
        return {
          ...ex,
          sets: remaining,
        };
      })
    );
  };

  const handleUpdateSet = (
    exerciseId: string,
    setId: string,
    field: keyof ManualSetItem,
    value: string | boolean
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
        };
      })
    );
  };

  // Live computed total tonnage
  const totalTonnage = exercises.reduce((acc, ex) => {
    return (
      acc +
      ex.sets.reduce((setAcc, s) => {
        const w = parseFloat(s.weight) || 0;
        const r = parseInt(s.reps, 10) || 0;
        return setAcc + w * r;
      }, 0)
    );
  }, 0);

  const resetForm = () => {
    setTitle("Силовая тренировка");
    setDurationMinutes("60");
    setNotes("");
    setExercises([]);
  };

  const handleSubmit = async () => {
    if (exercises.length === 0) {
      Alert.alert(
        "Внимание",
        "Добавьте хотя бы одно упражнение перед сохранением тренировки."
      );
      return;
    }

    const payloadExercises: WorkoutSessionExerciseItem[] = [];

    for (const ex of exercises) {
      const validSets = ex.sets
        .map((s, idx) => ({
          set_number: idx + 1,
          weight: parseFloat(s.weight) || 0,
          reps: parseInt(s.reps, 10) || 0,
          rpe: s.rpe.trim() ? parseFloat(s.rpe) || null : null,
          is_warmup: s.is_warmup,
        }))
        .filter((s) => s.weight > 0 && s.reps > 0);

      if (validSets.length > 0) {
        payloadExercises.push({
          exercise_id: ex.exercise_id || null,
          exercise_name: ex.exercise_name,
          exercise_type: ex.exercise_type,
          sets: validSets,
          notes: null,
        });
      }
    }

    if (payloadExercises.length === 0) {
      Alert.alert(
        "Не заполнены подходы",
        "Укажите корректный вес и число повторений (больше нуля) хотя бы для одного подхода."
      );
      return;
    }

    const dur = parseInt(durationMinutes, 10);
    const payload: WorkoutSessionCreate = {
      title: title.trim() || "Силовая тренировка",
      date: new Date().toISOString(),
      duration_minutes: isNaN(dur) || dur <= 0 ? 60 : dur,
      notes: notes.trim() || null,
      exercises: payloadExercises,
    };

    setIsSubmitting(true);
    try {
      const isOnline = await checkConnection();
      if (!isOnline) {
        await enqueueWorkoutSession(payload, user?.id);
        Alert.alert(
          "Офлайн-режим",
          "Тренировка сохранена локально и будет выгружена на сервер при появлении сети."
        );
      } else {
        await createWorkoutSession(payload);
        Alert.alert("Успешно!", "Тренировка успешно сохранена в дневник.");
      }
      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Не удалось сохранить тренировку";
      Alert.alert("Ошибка сохранения", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Запись тренировки</Text>
              <Text style={styles.headerSubtitle}>
                Внесите выполненные упражнения и подходы
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Meta Info Card */}
            <Card style={styles.metaCard}>
              <Text style={styles.fieldLabel}>Название тренировки</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Например: Жим и руки"
                placeholderTextColor={colors.text.muted}
                style={styles.input}
              />

              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Длительность (мин)</Text>
                  <TextInput
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    keyboardType="numeric"
                    placeholder="60"
                    placeholderTextColor={colors.text.muted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Итоговый тоннаж</Text>
                  <View style={styles.tonnageBadge}>
                    <Flame size={14} color="#f59e0b" />
                    <Text style={styles.tonnageValue}>
                      {formatWeight(totalTonnage)}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Заметки / Самочувствие</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Как прошла тренировка..."
                placeholderTextColor={colors.text.muted}
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={2}
              />
            </Card>

            {/* Exercises Section */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Dumbbell size={18} color={colors.brand.primary} />
                <Text style={styles.sectionTitle}>
                  Упражнения ({exercises.length})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCatalogVisible(true)}
                style={styles.addExerciseBtn}
                activeOpacity={0.7}
              >
                <Plus size={16} color={colors.brand.primary} />
                <Text style={styles.addExerciseBtnText}>Добавить</Text>
              </TouchableOpacity>
            </View>

            {exercises.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Dumbbell size={36} color={colors.text.muted} />
                <Text style={styles.emptyText}>Упражнения еще не добавлены</Text>
                <Text style={styles.emptySubtext}>
                  Выберите упражнения из каталога, чтобы внести рабочие веса
                </Text>
                <Button
                  title="+ Выбрать из каталога"
                  variant="outline"
                  size="sm"
                  onPress={() => setCatalogVisible(true)}
                  style={styles.emptyBtn}
                />
              </Card>
            ) : (
              exercises.map((ex, exIdx) => (
                <Card key={ex.id} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <View style={styles.exerciseTitleCol}>
                      <Text style={styles.exerciseIndex}>#{exIdx + 1}</Text>
                      <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveExercise(ex.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={18} color={colors.status.error} />
                    </TouchableOpacity>
                  </View>

                  {/* Sets Table Header */}
                  <View style={styles.setsHeader}>
                    <Text style={[styles.setsHeaderCol, styles.colSet]}>СЕТ</Text>
                    <Text style={[styles.setsHeaderCol, styles.colWeight]}>
                      ВЕС (КГ)
                    </Text>
                    <Text style={[styles.setsHeaderCol, styles.colReps]}>ПОВТ.</Text>
                    <Text style={[styles.setsHeaderCol, styles.colRpe]}>RPE</Text>
                    <Text style={[styles.setsHeaderCol, styles.colWarmup]}>РАЗМ.</Text>
                    <View style={styles.colDelete} />
                  </View>

                  {/* Sets Rows */}
                  {ex.sets.map((set, setIdx) => (
                    <View key={set.id} style={styles.setRow}>
                      <Text style={[styles.setCellText, styles.colSet]}>
                        {setIdx + 1}
                      </Text>

                      <View style={styles.colWeight}>
                        <TextInput
                          value={set.weight}
                          onChangeText={(val) =>
                            handleUpdateSet(ex.id, set.id, "weight", val)
                          }
                          keyboardType="numeric"
                          style={styles.cellInput}
                        />
                      </View>

                      <View style={styles.colReps}>
                        <TextInput
                          value={set.reps}
                          onChangeText={(val) =>
                            handleUpdateSet(ex.id, set.id, "reps", val)
                          }
                          keyboardType="numeric"
                          style={styles.cellInput}
                        />
                      </View>

                      <View style={styles.colRpe}>
                        <TextInput
                          value={set.rpe}
                          onChangeText={(val) =>
                            handleUpdateSet(ex.id, set.id, "rpe", val)
                          }
                          keyboardType="numeric"
                          placeholder="—"
                          placeholderTextColor={colors.text.muted}
                          style={styles.cellInput}
                        />
                      </View>

                      <View style={[styles.colWarmup, styles.centerAlign]}>
                        <Switch
                          value={set.is_warmup}
                          onValueChange={(val) =>
                            handleUpdateSet(ex.id, set.id, "is_warmup", val)
                          }
                          trackColor={{
                            false: colors.border.subtle,
                            true: colors.brand.primary,
                          }}
                          thumbColor={Platform.OS === "android" ? "#fff" : undefined}
                          style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                        />
                      </View>

                      <TouchableOpacity
                        onPress={() => handleRemoveSet(ex.id, set.id)}
                        style={styles.colDelete}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Minus size={16} color={colors.text.muted} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={() => handleAddSet(ex.id)}
                    style={styles.addSetRowBtn}
                    activeOpacity={0.7}
                  >
                    <Plus size={14} color={colors.brand.primary} />
                    <Text style={styles.addSetRowText}>Добавить подход</Text>
                  </TouchableOpacity>
                </Card>
              ))
            )}
          </ScrollView>

          {/* Footer Submit */}
          <View style={styles.footer}>
            <Button
              title={isSubmitting ? "Сохранение..." : "Сохранить в дневник"}
              variant="primary"
              size="lg"
              loading={isSubmitting}
              onPress={handleSubmit}
              style={styles.submitBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Catalog Selector */}
      <ExerciseCatalogModal
        visible={catalogVisible}
        onClose={() => setCatalogVisible(false)}
        onSelectExercise={handleAddExerciseFromCatalog}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.darkest,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.bg.card,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: colors.bg.dark,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  metaCard: {
    padding: 14,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.bg.dark,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 56,
    textAlignVertical: "top",
    marginBottom: 0,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfCol: {
    flex: 1,
  },
  tonnageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.bg.dark,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  tonnageValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f59e0b",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  addExerciseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    borderRadius: 8,
  },
  addExerciseBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand.primary,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  emptyBtn: {
    minWidth: 180,
  },
  exerciseCard: {
    padding: 14,
    marginBottom: 14,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  exerciseTitleCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  exerciseIndex: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand.primary,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
    flex: 1,
  },
  setsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 4,
  },
  setsHeaderCol: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text.muted,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  colSet: {
    width: 32,
    textAlign: "center",
  },
  colWeight: {
    flex: 2,
    marginHorizontal: 3,
  },
  colReps: {
    flex: 2,
    marginHorizontal: 3,
  },
  colRpe: {
    flex: 1.5,
    marginHorizontal: 3,
  },
  colWarmup: {
    width: 52,
    alignItems: "center",
  },
  colDelete: {
    width: 28,
    alignItems: "center",
  },
  centerAlign: {
    alignItems: "center",
    justifyContent: "center",
  },
  setCellText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  cellInput: {
    backgroundColor: colors.bg.dark,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
    textAlign: "center",
  },
  addSetRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border.subtle,
    borderRadius: 6,
  },
  addSetRowText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand.primary,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.bg.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  submitBtn: {
    width: "100%",
  },
});
