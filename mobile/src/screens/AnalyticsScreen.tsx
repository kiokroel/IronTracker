import { LineChart, TrendingUp, Zap } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "../components/common/Card";
import { Header } from "../components/common/Header";
import { colors } from "../theme/colors";

export const AnalyticsScreen: React.FC = () => {
  return (
    <View style={styles.screen}>
      <Header
        title="Аналитика и 1RM"
        subtitle="Прогрессия силы и макро-показатели"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <TrendingUp size={18} color={colors.brand.primary} />
              <Text style={styles.metricLabel}>Жим лежа (1RM)</Text>
            </View>
            <Text style={styles.metricValue}>125.0 kg</Text>
            <Text style={styles.metricChange}>+5.0 kg за месяц</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Zap size={18} color={colors.status.success} />
              <Text style={styles.metricLabel}>Приседания (1RM)</Text>
            </View>
            <Text style={styles.metricValue}>160.0 kg</Text>
            <Text style={styles.metricChange}>+7.5 kg за месяц</Text>
          </Card>
        </View>

        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <LineChart size={20} color={colors.brand.primary} />
            <Text style={styles.chartTitle}>Динамика прогресса</Text>
          </View>
          <Text style={styles.chartSubtitle}>
            График изменения расчетного максимума по формулам Эпли и Бжицки
          </Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.placeholderText}>
              📊 Модуль визуализации графиков Recharts / GiftedCharts
            </Text>
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
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metricCard: {
    flex: 0.48,
    padding: 14,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 6,
    fontWeight: "500",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 11,
    color: colors.status.success,
    fontWeight: "600",
  },
  chartCard: {
    padding: 16,
    marginTop: 8,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginLeft: 8,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
    marginBottom: 16,
  },
  chartPlaceholder: {
    height: 180,
    borderRadius: 10,
    backgroundColor: colors.bg.darkest,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border.subtle,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  placeholderText: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: "center",
  },
});
