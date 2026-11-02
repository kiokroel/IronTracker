import {
  Dumbbell,
  Filter,
  Plus,
  Search,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createCustomExercise, fetchExercises } from "../../api/exercises";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { colors } from "../../theme/colors";
import type {
  Equipment,
  Exercise,
  ExerciseCategory,
  MuscleGroup,
} from "../../types";

interface ExerciseCatalogModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise?: (exercise: Exercise) => void;
}

const MUSCLE_GROUPS: { label: string; value: MuscleGroup | "all" }[] = [
  { label: "Все", value: "all" },
  { label: "Грудь", value: "chest" },
  { label: "Спина", value: "back" },
  { label: "Ноги", value: "legs" },
  { label: "Плечи", value: "shoulders" },
  { label: "Руки", value: "arms" },
  { label: "Кор", value: "core" },
];

export const ExerciseCatalogModal: React.FC<ExerciseCatalogModalProps> = ({
  visible,
  onClose,
  onSelectExercise,
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New exercise form
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>("chest");
  const [newCategory, setNewCategory] = useState<ExerciseCategory>("strength");
  const [newEquipment, setNewEquipment] = useState<Equipment>("barbell");
  const [creating, setCreating] = useState(false);

  const loadExercises = async () => {
    setLoading(true);
    try {
      const data = await fetchExercises({
        search: search.trim() || undefined,
        muscle_group: selectedMuscle === "all" ? undefined : selectedMuscle,
      });
      setExercises(data);
    } catch {
      // Offline fallback mock data if server is unreachable
      if (exercises.length === 0) {
        setExercises([
          {
            id: "mock-1",
            name: "Жим штанги лежа",
            category: "strength",
            target_muscle_groups: ["chest"],
            equipment: "barbell",
            is_custom: false,
            created_at: new Date().toISOString(),
          },
          {
            id: "mock-2",
            name: "Приседания со штангой",
            category: "strength",
            target_muscle_groups: ["legs"],
            equipment: "barbell",
            is_custom: false,
            created_at: new Date().toISOString(),
          },
          {
            id: "mock-3",
            name: "Становая тяга",
            category: "strength",
            target_muscle_groups: ["back"],
            equipment: "barbell",
            is_custom: false,
            created_at: new Date().toISOString(),
          },
          {
            id: "mock-4",
            name: "Армейский жим стоя",
            category: "strength",
            target_muscle_groups: ["shoulders"],
            equipment: "barbell",
            is_custom: false,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadExercises();
    }
  }, [visible, selectedMuscle]);

  const handleCreateExercise = async () => {
    if (!newName.trim()) {
      Alert.alert("Ошибка", "Введите название упражнения");
      return;
    }

    setCreating(true);
    try {
      const created = await createCustomExercise({
        name: newName.trim(),
        category: newCategory,
        target_muscle_groups: [newMuscle],
        equipment: newEquipment,
      });
      setExercises((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewName("");
      Alert.alert("Успешно", "Новое упражнение добавлено в каталог");
    } catch {
      Alert.alert("Ошибка", "Не удалось создать упражнение на сервере");
    } finally {
      setCreating(false);
    }
  };

  const filtered = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchesMuscle =
      selectedMuscle === "all" ||
      ex.target_muscle_groups.includes(selectedMuscle);
    return matchesSearch && matchesMuscle;
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Modal Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Dumbbell size={22} color={colors.brand.primary} />
            <Text style={styles.headerTitle}>Каталог упражнений</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color={colors.text.muted} style={styles.searchIcon} />
          <TextInput
            placeholder="Поиск упражнения..."
            placeholderTextColor={colors.text.muted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={loadExercises}
            style={styles.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <X size={16} color={colors.text.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Muscle Group Chips */}
        <View style={styles.chipsContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={MUSCLE_GROUPS}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const active = selectedMuscle === item.value;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedMuscle(item.value)}
                  style={[styles.chip, active && styles.activeChip]}
                >
                  <Text
                    style={[styles.chipText, active && styles.activeChipText]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Exercise List */}
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <Text style={styles.loaderText}>Загрузка упражнений...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  if (onSelectExercise) {
                    onSelectExercise(item);
                    onClose();
                  }
                }}
              >
                <Card style={styles.exerciseCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    {item.is_custom && (
                      <View style={styles.customBadge}>
                        <Text style={styles.customBadgeText}>Кастомное</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.tagsRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>
                        {item.target_muscle_groups.join(", ") || "Общее"}
                      </Text>
                    </View>
                    <View style={styles.tagSecondary}>
                      <Text style={styles.tagSecondaryText}>{item.equipment}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Filter size={36} color={colors.text.muted} />
                <Text style={styles.emptyTitle}>Упражнения не найдены</Text>
                <Text style={styles.emptySubtitle}>
                  Попробуйте изменить поисковый запрос или добавьте новое
                </Text>
              </View>
            }
          />
        )}

        {/* Floating Create Button */}
        <View style={styles.footer}>
          <Button
            title="Создать упражнение"
            onPress={() => setShowCreateModal(true)}
            icon={<Plus size={18} color="#ffffff" />}
          />
        </View>

        {/* Nested Create Exercise Modal */}
        <Modal
          visible={showCreateModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Card style={styles.createCard}>
              <View style={styles.createHeader}>
                <Text style={styles.createTitle}>Новое упражнение</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <X size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Название</Text>
              <TextInput
                placeholder="Например: Жим гантелей на наклонной"
                placeholderTextColor={colors.text.muted}
                value={newName}
                onChangeText={setNewName}
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Мышечная группа</Text>
              <View style={styles.selectRow}>
                {MUSCLE_GROUPS.filter((m) => m.value !== "all").map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    onPress={() => setNewMuscle(m.value as MuscleGroup)}
                    style={[
                      styles.smallChip,
                      newMuscle === m.value && styles.activeChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.smallChipText,
                        newMuscle === m.value && styles.activeChipText,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.createActions}>
                <Button
                  title="Отмена"
                  variant="secondary"
                  onPress={() => setShowCreateModal(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Добавить"
                  onPress={handleCreateExercise}
                  loading={creating}
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </Card>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.darkest,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    marginLeft: 8,
  },
  closeBtn: {
    padding: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.dark,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bg.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  activeChip: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  activeChipText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  exerciseCard: {
    padding: 14,
    marginVertical: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    flex: 1,
  },
  customBadge: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  customBadgeText: {
    fontSize: 11,
    color: colors.brand.primary,
    fontWeight: "700",
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tag: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  tagText: {
    fontSize: 12,
    color: colors.text.secondary,
    textTransform: "capitalize",
  },
  tagSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagSecondaryText: {
    fontSize: 12,
    color: colors.text.muted,
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
  empty: {
    alignItems: "center",
    paddingTop: 60,
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
    marginTop: 4,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.bg.darkest,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    padding: 20,
  },
  createCard: {
    padding: 20,
  },
  createHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },
  inputLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  selectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  smallChipText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  createActions: {
    flexDirection: "row",
    marginTop: 10,
  },
});
