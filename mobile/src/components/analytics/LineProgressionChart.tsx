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
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { colors } from "../../theme/colors";
import type { OneRepMaxPoint } from "../../types";
import { computeLineProgressionChartData } from "../../utils/analytics";

export interface LineProgressionChartProps {
  data: OneRepMaxPoint[];
  title?: string;
  unit?: string;
  color?: string;
  height?: number;
}

export const LineProgressionChart: React.FC<LineProgressionChartProps> = ({
  data,
  title = "Динамика 1RM",
  unit = "kg",
  color = colors.brand.primary,
  height = 200,
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

  // Dimensions & paddings
  const chartWidth = Math.max(containerWidth, 240);
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  // Active point index: default to last point if none selected
  const activeIndex =
    selectedIndex !== null && selectedIndex < data.length
      ? selectedIndex
      : data.length > 0
      ? data.length - 1
      : null;

  const activePoint = activeIndex !== null ? data[activeIndex] : null;

  // Compute min, max, scale
  const { minVal, maxVal, coordinates, pathD, areaD, yTicks } = useMemo(() => {
    return computeLineProgressionChartData(
      data,
      innerWidth,
      innerHeight,
      paddingLeft,
      paddingTop
    );
  }, [data, innerWidth, innerHeight, paddingLeft, paddingTop]);

  if (data.length === 0) {
    return (
      <View style={styles.card} onLayout={handleLayout}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.emptyContainer, { height: height - 40 }]}>
          <Text style={styles.emptyText}>
            Нет данных по 1RM для выбранного движения
          </Text>
          <Text style={styles.emptySubtext}>
            Выполните упражнение на тренировке, чтобы увидеть график
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
              {activePoint.exerciseName} • {activePoint.formattedDate}
            </Text>
          )}
        </View>
        {activePoint && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeValue}>
              {activePoint.oneRepMax} {unit}
            </Text>
            <Text style={styles.badgeSub}>
              {activePoint.weight} {unit} × {activePoint.reps}
            </Text>
          </View>
        )}
      </View>

      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines & Y labels */}
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
              x={paddingLeft - 8}
              y={tick.y + 4}
              fill={colors.text.muted}
              fontSize={10}
              fontWeight="500"
              textAnchor="end"
            >
              {Math.round(tick.val)}
            </SvgText>
          </G>
        ))}

        {/* Area fill */}
        {areaD ? <Path d={areaD} fill="url(#lineAreaGrad)" /> : null}

        {/* Main Progression Line */}
        {pathD ? (
          <Path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Data points & touch triggers */}
        {coordinates.map(({ x, y, point, index }) => {
          const isSelected = activeIndex === index;
          return (
            <G key={`point-${index}`}>
              {/* Outer halo for active point */}
              {isSelected && (
                <Circle
                  cx={x}
                  cy={y}
                  r={8}
                  fill={color}
                  opacity={0.3}
                />
              )}
              {/* Point circle */}
              <Circle
                cx={x}
                cy={y}
                r={isSelected ? 5 : 3.5}
                fill={isSelected ? color : colors.bg.darkest}
                stroke={color}
                strokeWidth={2}
              />
              {/* Date label on X axis */}
              {(coordinates.length <= 6 ||
                index === 0 ||
                index === coordinates.length - 1 ||
                index === Math.floor(coordinates.length / 2)) && (
                <SvgText
                  x={x}
                  y={paddingTop + innerHeight + 18}
                  fill={isSelected ? colors.text.primary : colors.text.muted}
                  fontSize={10}
                  fontWeight={isSelected ? "700" : "400"}
                  textAnchor="middle"
                >
                  {point.formattedDate}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>

      {/* Point selector touch buttons below chart for accessibility */}
      {data.length > 1 && (
        <View style={styles.pointsSelectorRow}>
          {data.map((point, idx) => {
            const isSelected = activeIndex === idx;
            return (
              <TouchableOpacity
                key={`selector-${idx}`}
                style={[
                  styles.selectorButton,
                  isSelected && styles.selectorButtonActive,
                ]}
                onPress={() => setSelectedIndex(idx)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.selectorButtonText,
                    isSelected && styles.selectorButtonTextActive,
                  ]}
                >
                  #{idx + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
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
  pointsSelectorRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 6,
  },
  selectorButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.bg.dark,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  selectorButtonActive: {
    borderColor: colors.brand.primary,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
  },
  selectorButtonText: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: "600",
  },
  selectorButtonTextActive: {
    color: colors.brand.primary,
    fontWeight: "700",
  },
});

export default LineProgressionChart;
