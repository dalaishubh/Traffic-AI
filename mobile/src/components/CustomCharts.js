import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop, G, Line } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const screenWidth = Dimensions.get('window').width;

// 1. AREA CHART: CongestionTrendChart
export const CongestionTrendChart = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const data = [
    { hour: '06', val: 18 }, { hour: '07', val: 32 }, { hour: '08', val: 58 },
    { hour: '09', val: 74 }, { hour: '10', val: 62 }, { hour: '11', val: 48 },
    { hour: '12', val: 42 }, { hour: '13', val: 44 }, { hour: '14', val: 40 },
    { hour: '15', val: 46 }, { hour: '16', val: 55 }, { hour: '17', val: 71 },
    { hour: '18', val: 82 }, { hour: '19', val: 78 }, { hour: '20', val: 60 },
    { hour: '21', val: 38 }, { hour: '22', val: 24 },
  ];

  const chartHeight = 150;
  const paddingX = 35;
  const paddingY = 20;
  
  const chartWidth = screenWidth - 64; // accounts for page margins
  const activeWidth = chartWidth - paddingX;
  const activeHeight = chartHeight - paddingY * 2;

  const maxVal = 100;

  // Compute points
  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * activeWidth;
    const y = paddingY + activeHeight - (d.val / maxVal) * activeHeight;
    return { x, y, ...d };
  });

  // Generate SVG path string
  let linePath = '';
  let areaPath = '';

  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    points.forEach((p, idx) => {
      if (idx > 0) {
        linePath += ` L ${p.x} ${p.y}`;
      }
    });

    // Close the area path to the bottom boundary
    areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingY + activeHeight} L ${points[0].x} ${paddingY + activeHeight} Z`;
  }

  const yTicks = [0, 25, 50, 75, 100];
  const xTicksIndices = [0, 4, 8, 12, 16]; // 06:00, 10:00, 14:00, 18:00, 22:00

  return (
    <View style={styles.card}>
      <Text style={styles.chartTitle}>Historical congestion trend</Text>
      <Text style={styles.chartSubtitle}>Average corridor congestion index by hour of day</Text>
      
      <View style={{ height: chartHeight, width: chartWidth, marginTop: 12 }}>
        <Svg height={chartHeight} width={chartWidth}>
          <Defs>
            <LinearGradient id="congArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = paddingY + activeHeight - (tick / maxVal) * activeHeight;
            return (
              <G key={i}>
                <Line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              </G>
            );
          })}

          {/* Area under the curve */}
          {areaPath !== '' && <Path d={areaPath} fill="url(#congArea)" />}

          {/* Stroke line */}
          {linePath !== '' && (
            <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2} />
          )}

          {/* Y Axis text labels */}
          {yTicks.map((tick, i) => {
            const y = paddingY + activeHeight - (tick / maxVal) * activeHeight;
            return (
              <SvgText
                key={i}
                x={8}
                y={y + 4}
                fill={colors.textSubtle}
                fontSize={10}
                fontFamily="system-ui"
              >
                {tick}
              </SvgText>
            );
          })}

          {/* X Axis text labels */}
          {xTicksIndices.map((idx) => {
            const p = points[idx];
            if (!p) return null;
            return (
              <SvgText
                key={idx}
                x={p.x - 8}
                y={chartHeight - 4}
                fill={colors.textSubtle}
                fontSize={10}
              >
                {p.hour}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
};

// SvgText helper to bypass React Native text wrappers inside SVG
const SvgText = ({ children, x, y, fill, fontSize, fontWeight }) => {
  return (
    <Circle cx={x} cy={y} r={0}>
      <Path d="" />
      <G>
        <Text style={{ position: 'absolute', left: x, top: y - 10, color: fill, fontSize: fontSize, fontWeight: fontWeight }}>
          {children}
        </Text>
      </G>
    </Circle>
  );
};

// 2. PIE / DONUT CHART: RiskBreakdownChart
export const RiskBreakdownChart = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const rawData = [
    { name: 'Low', value: 42, color: colors.success },
    { name: 'Medium', value: 28, color: colors.warning },
    { name: 'High', value: 18, color: '#F97316' },
    { name: 'Critical', value: 12, color: colors.danger },
  ];

  const total = rawData.reduce((acc, d) => acc + d.value, 0);
  const size = 130;
  const radius = 45;
  const strokeWidth = 14;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <View style={styles.card}>
      <Text style={styles.chartTitle}>Risk distribution</Text>
      <Text style={styles.chartSubtitle}>Share of analyzed events by risk tier</Text>

      <View style={styles.pieContainer}>
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
          <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
            {rawData.map((d, index) => {
              const percentage = d.value / total;
              const strokeDashoffset = circumference - percentage * circumference;
              const offset = currentOffset;
              currentOffset += percentage * circumference;

              return (
                <Circle
                  key={index}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={d.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={offset}
                  fill="none"
                />
              );
            })}
          </Svg>
          {/* Inner Text overlay */}
          <View style={styles.pieInnerLabel}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>100%</Text>
            <Text style={{ fontSize: 8, color: colors.textSubtle }}>Events</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          {rawData.map((d, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: d.color }]} />
              <Text style={styles.legendText}>
                {d.name}: <Text style={{ fontWeight: 'bold' }}>{d.value}%</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// 3. BAR CHART: ResourceChart
export const ResourceChart = ({ officers = 0, barricades = 0 }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const chartHeight = 120;
  const chartWidth = screenWidth - 64;
  const maxVal = Math.max(officers, barricades, 10) * 1.2;

  const data = [
    { name: 'Officers', val: officers, color: colors.primary },
    { name: 'Barricades', val: barricades, color: colors.warning },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.chartTitle}>Resource requirement</Text>
      <Text style={styles.chartSubtitle}>Recommended deployment based on current forecast</Text>

      <View style={{ height: chartHeight, width: chartWidth, marginTop: 16 }}>
        <Svg height={chartHeight} width={chartWidth}>
          {/* Grid lines */}
          {[0, 0.5, 1].map((p, i) => {
            const y = 10 + p * (chartHeight - 40);
            return (
              <Line
                key={i}
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            );
          })}

          {data.map((d, idx) => {
            const barW = 55;
            const gap = 80;
            const x = chartWidth / 2 - gap + idx * (barW + gap) - barW / 2;
            const barH = (d.val / maxVal) * (chartHeight - 40);
            const y = chartHeight - 30 - barH;

            return (
              <G key={idx}>
                {/* Bar */}
                <Rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH > 0 ? barH : 2}
                  fill={d.color}
                  rx={6}
                  ry={6}
                />
              </G>
            );
          })}
        </Svg>
        {/* Label Overlays */}
        <View style={styles.barLabelRow}>
          {data.map((d, idx) => (
            <View key={idx} style={styles.barLabelCol}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: 'bold' }}>{d.val}</Text>
              <Text style={{ color: colors.textSubtle, fontSize: 11, marginTop: 2 }}>{d.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// 4. HORIZONTAL BAR CHART: CorridorRankings
export const CorridorRankings = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const rankings = [
    { name: 'Mysore Road', events: 743, score: 82 },
    { name: 'Bellary Road 1', events: 610, score: 33 },
    { name: 'ORR North 1', events: 275, score: 22 },
    { name: 'ORR East 1', events: 244, score: 18 },
    { name: 'Hosur Road', events: 298, score: 17 },
    { name: 'Tumkur Road', events: 458, score: 12 },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.chartTitle}>Corridor rankings</Text>
      <Text style={styles.chartSubtitle}>Top corridors by average congestion score</Text>
      
      <View style={{ marginTop: 12 }}>
        {rankings.map((r, index) => (
          <View key={index} style={styles.rankingRow}>
            <View style={styles.rankingHeader}>
              <Text style={styles.rankingName}>{r.name}</Text>
              <Text style={styles.rankingScore}>{r.score} avg</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${r.score}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'system-ui',
  },
  chartSubtitle: {
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: 2,
  },
  pieContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  pieInnerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  barLabelRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  barLabelCol: {
    alignItems: 'center',
    width: 120,
  },
  rankingRow: {
    marginBottom: 12,
  },
  rankingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rankingName: {
    color: colors.textMuted,
    fontSize: 12,
  },
  rankingScore: {
    color: colors.text,
    fontSize: 11,
    fontWeight: 'bold',
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.surface2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
});
