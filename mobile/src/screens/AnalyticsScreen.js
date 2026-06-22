import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  Platform,
  StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  CongestionTrendChart,
  RiskBreakdownChart,
  CorridorRankings
} from '../components/CustomCharts';

const CORRIDOR_RISK_SCORES = {
  "Mysore Road": 0.82,
  "Bellary Road 1": 0.33,
  "ORR North 1": 0.22,
  "ORR East 1": 0.18,
  "Hosur Road": 0.17,
  "Tumkur Road": 0.12,
  "Bellary Road 2": 0.12,
  "Old Madras Road": 0.12,
  "Magadi Road": 0.10,
};

const getCorridorRisk = (name) => CORRIDOR_RISK_SCORES[name] || 0.2;
const getJunctionRisk = () => 0.25;

export default function AnalyticsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  // Simulator inputs
  const [corridor, setCorridor] = useState('Mysore Road');
  const [attendance, setAttendance] = useState('5000');
  const [duration, setDuration] = useState('3');
  const [startHour, setStartHour] = useState(18);
  const [roadClosure, setRoadClosure] = useState(true);

  const [showCorridorSelect, setShowCorridorSelect] = useState(false);
  const [showHourSelect, setShowHourSelect] = useState(false);

  // Dynamic simulation computation (identical client-side logic to web)
  const simulatedScenarios = useMemo(() => {
    const eventsToCompare = [
      { id: 'vehicle_breakdown', label: 'Vehicle Breakdown', severity: 1 },
      { id: 'pot_holes', label: 'Potholes', severity: 2 },
      { id: 'road_conditions', label: 'Bad Road Conditions', severity: 2 },
      { id: 'fog_low_visibility', label: 'Fog / Low Visibility', severity: 2 },
      { id: 'debris', label: 'Debris on Road', severity: 3 },
      { id: 'congestion', label: 'Normal Congestion', severity: 3 },
      { id: 'water_logging', label: 'Water Logging / Flooding', severity: 3 },
      { id: 'others', label: 'Others', severity: 3 },
      { id: 'tree_fall', label: 'Tree Fall', severity: 4 },
      { id: 'accident', label: 'Road Accident', severity: 4 },
      { id: 'construction', label: 'Road Construction', severity: 5 },
      { id: 'public_event', label: 'Concert / Public Event', severity: 6 },
      { id: 'procession', label: 'Religious/Public Procession', severity: 7 },
      { id: 'political_rally', label: 'Political Rally', severity: 8 },
      { id: 'vip_movement', label: 'VIP / Convoy Movement', severity: 9 },
      { id: 'protest', label: 'Protest / Demonstration', severity: 9 }
    ];

    const attNum = Number(attendance) || 0;
    const durNum = Number(duration) || 1;

    return eventsToCompare.map(evt => {
      let score = 0;
      score += Math.min(attNum / 1000, 10) * 4;
      score += Math.min(durNum, 8) * 2;
      score += evt.severity * 4;
      score += getCorridorRisk(corridor) * 20;
      score += getJunctionRisk() * 20;

      if (roadClosure) {
        score += 15;
      }

      const isPeak = [8, 9, 10, 17, 18, 19, 20].includes(startHour);
      const timeFactor = isPeak ? 1.8 : 1.0;
      score += Math.max((timeFactor - 1) * 10, 0);

      const eventBonus = {
        vip_movement: 10,
        political_rally: 8,
        protest: 10,
        procession: 5
      };
      score += eventBonus[evt.id] || 0;
      const finalScore = Math.min(Math.round(score * 100) / 100, 100);

      let delay = 5;
      delay += attNum / 500;
      delay += durNum * 2;
      if (roadClosure) {
        delay += 10;
      }
      delay += finalScore * 0.2;
      const finalDelay = Math.min(Math.round(delay), 120);

      let officers = 0;
      const minorHazardTypes = [
        "vehicle_breakdown", "pot_holes", "road_conditions",
        "water_logging", "fog_low_visibility", "debris", "congestion",
      ];
      if (evt.id === 'vehicle_breakdown') {
        officers = 3;
      } else if (minorHazardTypes.includes(evt.id)) {
        officers = 4;
      } else if (['accident', 'tree_fall'].includes(evt.id)) {
        officers = 5;
      } else if (evt.id === 'construction') {
        officers = 5;
        if (finalScore >= 80) officers += 2;
        else if (finalScore >= 60) officers += 1;
      } else {
        officers = 5 + Math.floor(attNum / 1000);
        const eventBoost = {
          others: 1,
          public_event: 2,
          procession: 3,
          political_rally: 5,
          vip_movement: 7,
          protest: 8,
        };
        officers += eventBoost[evt.id] || 0;
        if (finalScore >= 80) officers += 5;
        else if (finalScore >= 60) officers += 3;
      }
      const finalOfficers = Math.min(officers, 50);

      let riskLevel = 'Low';
      if (finalScore >= 75) riskLevel = 'Critical';
      else if (finalScore >= 50) riskLevel = 'High';
      else if (finalScore >= 25) riskLevel = 'Medium';

      return {
        ...evt,
        score: finalScore,
        delay: finalDelay,
        officers: finalOfficers,
        risk: riskLevel
      };
    });
  }, [corridor, attendance, duration, startHour, roadClosure]);

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Analytics</Text>
          <Text style={styles.title}>Executive Overview</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={styles.themeToggleButton}>
          <Feather name={isDark ? "sun" : "moon"} size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.desc}>
          Aggregated traffic intelligence across the city's monitored corridors and historical event database.
        </Text>

        {/* KPI Cards row */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Events</Text>
            <Text style={styles.kpiValue}>8,173</Text>
            <Text style={styles.kpiSub}>Last 24 months</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiLabel, { color: colors.danger }]}>High Risk Events</Text>
            <Text style={styles.kpiValue}>1,427</Text>
            <Text style={styles.kpiSub}>17.5% of total</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg. Congestion</Text>
            <Text style={styles.kpiValue}>54.8</Text>
            <Text style={styles.kpiSub}>Citywide baseline</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Top Disruption</Text>
            <Text style={styles.kpiValue} numberOfLines={1}>Mysore Rd</Text>
            <Text style={styles.kpiSub}>82 avg score</Text>
          </View>
        </View>

        {/* Congestion Trend Area Chart */}
        <CongestionTrendChart />

        {/* Risk Distribution Donut chart */}
        <RiskBreakdownChart />

        {/* Corridor rankings */}
        <CorridorRankings />

        {/* Dynamic Simulator Section */}
        <View style={styles.simulatorHeaderContainer}>
          <Text style={styles.simulatorHeaderTitle}>Multi-Event Scenario Simulator</Text>
          <Text style={styles.simulatorHeaderDesc}>
            Compare how a single location handles different event profiles simultaneously.
          </Text>
        </View>

        <View style={styles.card}>
          {/* Simulator Inputs */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Select Corridor</Text>
            <TouchableOpacity
              onPress={() => setShowCorridorSelect(!showCorridorSelect)}
              style={styles.dropdownTrigger}
            >
              <Text style={{ color: colors.text, fontSize: 13 }}>{corridor}</Text>
              <Feather name={showCorridorSelect ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSubtle} />
            </TouchableOpacity>
            {showCorridorSelect && (
              <View style={styles.dropdownOptions}>
                {Object.keys(CORRIDOR_RISK_SCORES).map((name) => (
                  <TouchableOpacity
                    key={name}
                    onPress={() => {
                      setCorridor(name);
                      setShowCorridorSelect(false);
                    }}
                    style={[styles.dropdownOption, corridor === name && styles.dropdownOptionActive]}
                  >
                    <Text style={[styles.dropdownOptionText, corridor === name && { color: colors.primary }]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inlineInputsRow}>
            <View style={[styles.inputGroup, { width: '48%' }]}>
              <Text style={styles.inputLabel}>Attendance</Text>
              <TextInput
                value={attendance}
                onChangeText={setAttendance}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={[styles.inputGroup, { width: '48%' }]}>
              <Text style={styles.inputLabel}>Duration (Hrs)</Text>
              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.inlineInputsRow}>
            <View style={[styles.inputGroup, { width: '48%' }]}>
              <Text style={styles.inputLabel}>Start Hour</Text>
              <TouchableOpacity
                onPress={() => setShowHourSelect(!showHourSelect)}
                style={styles.dropdownTrigger}
              >
                <Text style={{ color: colors.text, fontSize: 13 }}>{String(startHour).padStart(2, '0')}:00</Text>
                <Feather name={showHourSelect ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSubtle} />
              </TouchableOpacity>
              {showHourSelect && (
                <View style={[styles.dropdownOptions, { maxHeight: 110 }]}>
                  <ScrollView nestedScrollEnabled>
                    {Array.from({ length: 24 }, (_, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          setStartHour(i);
                          setShowHourSelect(false);
                        }}
                        style={styles.dropdownOption}
                      >
                        <Text style={styles.dropdownOptionText}>{String(i).padStart(2, '0')}:00</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.switchLabel}>Road Closure</Text>
              <Switch
                value={roadClosure}
                onValueChange={setRoadClosure}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          </View>

          {/* Simulator Table View */}
          <Text style={styles.tableTitle}>Simulated Outputs</Text>
          <View style={styles.tableBorder}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'left' }]}>Event Profile</Text>
              <Text style={styles.tableHeaderCell}>Risk</Text>
              <Text style={styles.tableHeaderCell}>Delay</Text>
              <Text style={styles.tableHeaderCell}>Officers</Text>
            </View>

            {simulatedScenarios.map((s, idx) => {
              const riskColor = s.risk === 'Critical' ? colors.danger :
                                s.risk === 'High' || s.risk === 'Medium' ? colors.warning :
                                colors.success;
              return (
                <View key={s.id} style={styles.tableRow}>
                  <Text style={[styles.tableCellName, { flex: 1.5 }]} numberOfLines={1}>{s.label}</Text>
                  <View style={styles.tableCellCenter}>
                    <View style={[styles.badge, { backgroundColor: riskColor + '1A', borderColor: riskColor }]}>
                      <Text style={[styles.badgeText, { color: riskColor }]}>{s.risk}</Text>
                    </View>
                  </View>
                  <Text style={styles.tableCellVal}>{s.delay}m</Text>
                  <Text style={styles.tableCellVal}>{s.officers}p</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 8,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 2,
  },
  themeToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: {
    fontSize: 12,
    color: colors.textSubtle,
    lineHeight: 18,
    marginBottom: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textSubtle,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: colors.textSubtle,
    marginTop: 2,
  },
  simulatorHeaderContainer: {
    marginTop: 8,
    marginBottom: 10,
  },
  simulatorHeaderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  simulatorHeaderDesc: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    color: colors.textSubtle,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
  },
  dropdownOptions: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionActive: {
    backgroundColor: colors.primarySoft,
  },
  dropdownOptionText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  inlineInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
    height: 38,
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '48%',
    height: 38,
    marginTop: 8,
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textSubtle,
    textTransform: 'uppercase',
  },
  tableTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  tableBorder: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    flex: 1,
    textAlign: 'center',
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  tableCellName: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  tableCellCenter: {
    flex: 1,
    alignItems: 'center',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  tableCellVal: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
