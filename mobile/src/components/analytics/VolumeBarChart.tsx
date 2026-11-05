import React, { useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { colors } from "../../theme/colors";
import type { VolumeTrendPoint } from "../../types";
import { computeVolumeBarChartData } from "../../utils/analytics";
import { formatWeight } from "../../utils/fitness";

export interface VolumeBarChartProps {
  data: VolumeTrendPoint[];
  title?: string;
  color?: string;
  height?: number;
  maxBars?: number;
}

export const VolumeBarChart: React.FC<VolumeBarChartProps> = ({
  data,
  title = "Объем тоннажа по тренировкам",
  color = colors.brand.primary,
  height = 200,
  maxBars = 7,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number>(
    windowWidth - 64
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setContainerWidth(w);
    }
  };

  // Restrict to last `maxBars` sessions for clean mobile presentation
  const visibleData = useMemo(() => {
    if (data.length <= maxBars) return data;
    return data.slice(data.length - maxBars);
  }, [data, maxBars]);

  // Chart paddings
  const chartWidth = Math.max(containerWidth, 240);
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  // Active bar
  const activeIndex =
    selectedIndex !== null && selectedIndex < visibleData.length
      ? selectedIndex
      : visibleData.length > 0
      ? visibleData.length - 1
      : null;

  const activePoint = activeIndex !== null ? visibleData[activeIndex] : null;

  // Compute bar positions and scales
  const { maxVolume, bars, yTicks } = useMemo(() => {
    return computeVolumeBarChartData(
      visibleData,
      innerWidth,
      innerHeight,
      paddingLeft,
      paddingTop
    );
  }, [visibleData, innerWidth, innerHeight, paddingLeft, paddingTop]);

  if (visibleData.length === 0) {
    return (
      <View style={styles.card} onLayout={handleLayout}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.emptyContainer, { height: height - 40 }]}>
          <Text style={styles.emptyText}>Нет тренировок с тоннажем</Text>
          <Text style={styles.emptySubtext}>
            Завершите силовую сессию для визуализации тренда объема
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card} onLayout={handleLayout}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {activePoint && (
            <Text style={styles.subtitle}>
              {activePoint.title} • {activePoint.formattedDate}
            </Text>
          )}
        </View>
        {activePoint && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeValue}>
              {formatWeight(activePoint.volume)}
            </Text>
            {activePoint.durationMinutes ? (
              <Text style={styles.badgeSub}>
                {activePoint.durationMinutes} мин • {activePoint.exerciseCount} упр.
              </Text>
            ) : (
              <Text style={styles.badgeSub}>
                {activePoint.exerciseCount} упр.
              </Text>
            )}
          </View>
        )}
      </View>

      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={colors.brand.dark} stopOpacity="0.7" />
          </LinearGradient>
          <LinearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.brand.light} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.9" />
          </LinearGradient>
        </Defs>

        {/* Grid lines & Y scale */}
        {yTicks.map((tick, i) => (
          <G key={`tick-${i}`}>
            <Line
              x1={paddingLeft}
              y1={tick.y}
              x2={paddingLeft + innerWidth}
              y2={tick.y}
              stroke={colors.border.subtle}
              strokeWidth={1}
              strokeDasharray="4, 4"
            />
            <SvgText
              x={paddingLeft - 6}
              y={tick.y + 4}
              fill={colors.text.muted}
              fontSize={10}
              fontWeight="500"
              textAnchor="end"
            >
              {tick.val >= 1000 ? `${(tick.val / 1000).toFixed(1)}t` : tick.val}
            </SvgText>
          </G>
        ))}

        {/* Volume Bars */}
        {bars.map(({ x, y, width, height: barH, item, index, centerX }) => {
          const isSelected = activeIndex === index;
          return (
            <G key={`bar-${index}`}>
              {/* Bar Rect */}
              <Rect
                x={x}
                y={y}
                width={width}
                height={barH}
                rx={4}
                ry={4}
                fill={isSelected ? "url(#barGradActive)" : "url(#barGrad)"}
                opacity={isSelected ? 1 : 0.85}
              />

              {/* Date label under bar */}
              <SvgText
                x={centerX}
                y={paddingTop + innerHeight + 18}
                fill={isSelected ? colors.text.primary : colors.text.muted}
                fontSize={10}
                fontWeight={isSelected ? "700" : "400"}
                textAnchor="middle"
              >
                {item.formattedDate}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Bar touch selector buttons */}
      <View style={styles.selectorRow}>
        {visibleData.map((item, idx) => {
          const isSelected = activeIndex === idx;
          return (
            <TouchableOpacity
              key={`bar-btn-${idx}`}
              style={[
                styles.selectorBtn,
                isSelected && styles.selectorBtnActive,
              ]}
              onPress={() => setSelectedIndex(idx)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.selectorBtnText,
                  isSelected && styles.selectorBtnTextActive,
                ]}
              >
                {item.formattedDate}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  badgeContainer: {
    alignItems: "flex-end",
  },
  badgeValue: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.brand.primary,
  },
  badgeSub: {
    fontSize: 11,
    color: colors.text.muted,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: 4,
  },
  selectorRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 6,
  },
  selectorBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.bg.dark,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  selectorBtnActive: {
    borderColor: colors.brand.primary,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
  },
  selectorBtnText: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: "600",
  },
  selectorBtnTextActive: {
    color: colors.brand.primary,
    fontWeight: "700",
  },
});

export default VolumeBarChart;
