import { Flame, Play, Timer } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Header } from "../components/common/Header";
import { colors } from "../theme/colors";

export const LiveWorkoutScreen: React.FC = () => {
  const [isActive, setIsActive] = useState(false);

  return (
    <View style={styles.screen}>
      <Header
        title="Live Workout"
        subtitle="Интерактивный трекинг в зале"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.heroCard}>
          <View style={styles.badgeRow}>
            <View style={styles.liveBadge}>
              <Flame size={14} color={colors.brand.primary} />
              <Text style={styles.liveBadgeText}>
                {isActive ? "ТРЕНИРОВКА АКТИВНА" : "ГОТОВ К СТАРТУ"}
              </Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>Силовая сессия</Text>
          <Text style={styles.cardDescription}>
            Пошаговая запись подходов, индивидуальный вес, таймер отдыха между
            сетами и защита экрана от засыпания.
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
          </View>

          <Button
            title={isActive ? "Завершить тренировку" : "Запустить тренировку"}
            variant={isActive ? "danger" : "primary"}
            onPress={() => setIsActive(!isActive)}
            icon={<Play size={18} color="#ffffff" />}
          />
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
  heroCard: {
    padding: 20,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  liveBadge: {
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
});
