import { Dumbbell, Plus } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Header } from "../components/common/Header";
import { colors } from "../theme/colors";

export const WorkoutsScreen: React.FC = () => {
  return (
    <View style={styles.screen}>
      <Header
        title="Дневник тренировок"
        subtitle="История и прогресс силовых сессий"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={styles.emptyState}>
            <View style={styles.iconCircle}>
              <Dumbbell size={32} color={colors.brand.primary} />
            </View>
            <Text style={styles.emptyTitle}>Нет завершенных тренировок</Text>
            <Text style={styles.emptyText}>
              Запустите Live Workout режим для записи ваших подходов и фиксации
              тоннажа.
            </Text>
            <Button
              title="Начать тренировку"
              onPress={() => {}}
              style={styles.actionBtn}
              icon={<Plus size={18} color="#ffffff" />}
            />
          </View>
        </Card>
      </ScrollView>
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
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  actionBtn: {
    width: "100%",
  },
});
