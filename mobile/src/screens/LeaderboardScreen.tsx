import { Award, Trophy } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "../components/common/Card";
import { Header } from "../components/common/Header";
import { colors } from "../theme/colors";

const MOCK_LEADERS = [
  { rank: 1, name: "Иван Сидоров", tonnage: "14,250 kg", isCurrentUser: false },
  { rank: 2, name: "Алексей Смирнов", tonnage: "11,800 kg", isCurrentUser: false },
  { rank: 3, name: "Вы (Атлет)", tonnage: "9,450 kg", isCurrentUser: true },
  { rank: 4, name: "Дмитрий Ковалев", tonnage: "8,900 kg", isCurrentUser: false },
];

export const LeaderboardScreen: React.FC = () => {
  return (
    <View style={styles.screen}>
      <Header
        title="Лидерборд"
        subtitle="Рейтинг атлетов по тоннажу (Redis ZSET)"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <Trophy size={28} color={colors.brand.primary} />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>Соревновательный сезон</Text>
              <Text style={styles.bannerSubtitle}>
                Подсчет суммарного рабочего тоннажа в реальном времени
              </Text>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionHeader}>ТОП АТЛЕТОВ</Text>

        {MOCK_LEADERS.map((leader) => (
          <Card
            key={leader.rank}
            style={leader.isCurrentUser ? styles.currentCard : undefined}
          >
            <View style={styles.row}>
              <View style={styles.rankContainer}>
                {leader.rank <= 3 ? (
                  <Award
                    size={22}
                    color={
                      leader.rank === 1
                        ? "#f59e0b"
                        : leader.rank === 2
                        ? "#94a3b8"
                        : "#d97706"
                    }
                  />
                ) : (
                  <Text style={styles.rankText}>#{leader.rank}</Text>
                )}
              </View>
              <View style={styles.infoContainer}>
                <Text
                  style={[
                    styles.name,
                    leader.isCurrentUser && styles.currentName,
                  ]}
                >
                  {leader.name}
                </Text>
                <Text style={styles.tonnage}>{leader.tonnage}</Text>
              </View>
            </View>
          </Card>
        ))}
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
  bannerCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: "rgba(249, 115, 22, 0.08)",
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bannerTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankContainer: {
    width: 36,
    alignItems: "center",
  },
  rankText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.secondary,
  },
  infoContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginLeft: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  currentName: {
    color: colors.brand.primary,
    fontWeight: "700",
  },
  currentCard: {
    borderColor: colors.brand.primary,
    backgroundColor: "rgba(249, 115, 22, 0.05)",
  },
  tonnage: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
});
