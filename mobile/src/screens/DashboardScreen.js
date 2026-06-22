import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Platform,
  Alert,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { useTheme } from '../context/ThemeContext';
import { getForecast, getTimeline, getApiBaseUrl } from '../services/api';
import useReplayEngine from '../hooks/useReplayEngine';
import { getGridlockDashboardHtml } from '../assets/gridlockDashboardHtml';

import StrategyAdvisor from '../components/StrategyAdvisor';
import { ResourceChart } from '../components/CustomCharts';

const screenWidth = Dimensions.get('window').width;

const eventLabel = (v) => {
  const EVENT_TYPES = [
    { value: 'political_rally', label: 'Political Rally' },
    { value: 'procession', label: 'Procession' },
    { value: 'protest', label: 'Protest' },
    { value: 'vip_movement', label: 'VIP Movement' },
    { value: 'public_event', label: 'Public Gathering / Event' },
    { value: 'construction', label: 'Road Construction' },
    { value: 'accident', label: 'Road Accident' },
    { value: 'water_logging', label: 'Water Logging' },
    { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
  ];
  return (EVENT_TYPES.find((e) => e.value === v) || {}).label || v;
};

export default function DashboardScreen({ route, navigation }) {
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [inputParams, setInputParams] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [scenarioA, setScenarioA] = useState(null);
  const [scenarioB, setScenarioB] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [peakMin, setPeakMin] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  const { colors, isDark, toggleTheme } = useTheme();
  const webViewRef = useRef(null);

  const timelineSteps = timelineData && timelineData.length > 0
    ? timelineData.map(item => item.minute)
    : [0, 15, 30, 45, 60];

  const {
    currentMinute,
    isPlaying,
    speed,
    play,
    pause,
    reset,
    setSpeed,
    setMinute
  } = useReplayEngine(timelineSteps);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      setLoadingTimeline(true);

      const resolvedBaseUrl = await getApiBaseUrl();
      setApiBaseUrl(resolvedBaseUrl);

      const formDataStr = await AsyncStorage.getItem('forecast_form_data');
      if (!formDataStr) {
        navigation.navigate('Forecast');
        return;
      }

      setHasData(true);
      const parsedFormData = JSON.parse(formDataStr);
      setInputParams(parsedFormData);

      // 1. Fetch primary forecast
      const data = await getForecast(parsedFormData);
      setForecastData(data);

      // 2. Fetch scenario variations
      const [a, b] = await Promise.all([
        getForecast({ ...parsedFormData, road_closure: false }),
        getForecast({ ...parsedFormData, road_closure: true }),
      ]);
      setScenarioA(a);
      setScenarioB(b);

      // 3. Fetch timeline details
      const timelineRes = await getTimeline(
        data.incident_location.corridor,
        data.score,
        data.traffic_clearance_min
      );
      
      setTimelineData(timelineRes.timeline || []);
      setPeakMin(timelineRes.peak_congestion_minutes || 0);
      setConfidence(timelineRes.confidence_pct || 0);
      setLoadingTimeline(false);
      setLoading(false);

      // Update history in storage
      const historyStr = await AsyncStorage.getItem('tip-forecast-history');
      let historyList = historyStr ? JSON.parse(historyStr) : [];
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        eventLabel: eventLabel(parsedFormData.event_type),
        junction: parsedFormData.junction,
        score: data.score,
        risk: data.risk,
        delay: data.delay,
      };
      historyList = [entry, ...historyList].slice(0, 20);
      await AsyncStorage.setItem('tip-forecast-history', JSON.stringify(historyList));

    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
      setError('Failed to calculate forecast metrics. Simulation engine offline.');
      setLoadingTimeline(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [route.params?.refresh]);

  // Broadcast replay state changes to Leaflet WebView map
  useEffect(() => {
    if (webViewRef.current && timelineData.length > 0) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'REPLAY_UPDATE',
        minute: currentMinute,
        timeline: timelineData
      }));
    }
  }, [currentMinute, timelineData]);

  // Inject forecast data directly into the map when it finishes loading
  const injectForecastData = () => {
    if (webViewRef.current && forecastData) {
      const code = `
        window.setForecastData(${JSON.stringify(forecastData)});
        true;
      `;
      webViewRef.current.injectJavaScript(code);
    }
  };

  useEffect(() => {
    if (forecastData && !loading) {
      // Small timeout to give WebView time to fully render
      setTimeout(injectForecastData, 500);
    }
  }, [forecastData, loading]);

  const handleReset = () => {
    reset();
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'REPLAY_RESET' }));
    }
  };

  const handleExportPdf = async () => {
    if (!forecastData || !inputParams) return;

    try {
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; color: #1e293b; padding: 40px; }
              h1 { color: #2563eb; margin-bottom: 5px; }
              .date { color: #64748b; margin-bottom: 30px; font-size: 14px; }
              .section { margin-bottom: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; }
              h2 { font-size: 18px; color: #0f172a; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              td { padding: 8px 0; font-size: 14px; }
              .label { color: #64748b; font-weight: 500; width: 180px; }
              .value { color: #0f172a; font-weight: bold; }
              .kpi-row { display: flex; flex-wrap: wrap; margin-top: 15px; }
              .kpi-card { width: 48%; padding: 10px; margin-bottom: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box; }
              .kpi-num { font-size: 20px; font-weight: bold; color: #2563eb; margin-top: 5px; }
            </style>
          </head>
          <body>
            <h1>Urban Traffic Digital Twin Report</h1>
            <div class="date">Generated: ${new Date().toLocaleString()}</div>
            
            <div class="section">
              <h2>Event Parameters</h2>
              <table>
                <tr><td class="label">Event Type:</td><td class="value">${eventLabel(inputParams.event_type)}</td></tr>
                <tr><td class="label">Start Hour:</td><td class="value">${String(inputParams.start_hour).padStart(2, '0')}:00</td></tr>
                <tr><td class="label">Duration:</td><td class="value">${inputParams.duration_hours} hour(s)</td></tr>
                <tr><td class="label">Attendance:</td><td class="value">${Number(inputParams.attendance).toLocaleString()}</td></tr>
                <tr><td class="label">Corridor:</td><td class="value">${inputParams.corridor}</td></tr>
                <tr><td class="label">Junction:</td><td class="value">${inputParams.junction}</td></tr>
                <tr><td class="label">Road Closure:</td><td class="value">${inputParams.road_closure ? 'Active' : 'Not in effect'}</td></tr>
              </table>
            </div>

            <div class="section">
              <h2>Forecast Predictions</h2>
              <div class="kpi-row">
                <div class="kpi-card">
                  <div style="font-size:12px; color:#64748b;">RISK SCORE</div>
                  <div class="kpi-num">${forecastData.score.toFixed(1)} / 100</div>
                </div>
                <div class="kpi-card">
                  <div style="font-size:12px; color:#64748b;">RISK TIER</div>
                  <div class="kpi-num" style="color:#ef4444;">${forecastData.risk}</div>
                </div>
                <div class="kpi-card">
                  <div style="font-size:12px; color:#64748b;">EXPECTED DELAY</div>
                  <div class="kpi-num">${forecastData.delay} mins</div>
                </div>
                <div class="kpi-card">
                  <div style="font-size:12px; color:#64748b;">OFFICERS REQUIRED</div>
                  <div class="kpi-num">${forecastData.officers} personnel</div>
                </div>
              </div>
            </div>
            
            <div style="margin-top:50px; font-size:11px; color:#94a3b8; text-align:center;">
              Urban Traffic Digital Twin · Decision Support Intelligence
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert('Export Failed', 'Unable to export PDF report.');
    }
  };

  if (!hasData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSubtle }]}>Initializing simulation twin...</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={[styles.loadingText, { color: colors.textSubtle }]}>Running forecast simulation...</Text>
        <Text style={[styles.loadingSubtext, { color: colors.textSubtle }]}>Building digital twin layers</Text>
      </View>
    );
  }

  // Load the Leaflet map HTML template
  const mapHtml = getGridlockDashboardHtml(apiBaseUrl, '');

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.bg }]}>
      {/* Header Bar */}
      <View style={[styles.header, { backgroundColor: colors.surface2, borderBottomColor: colors.border, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>Forecast desk</Text>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{inputParams?.corridor}</Text>
          <Text style={[styles.subtitle, { color: colors.textSubtle }]} numberOfLines={1}>Junction: {inputParams?.junction}</Text>
        </View>
        
        <View style={styles.headerButtons}>
          {/* Switch Theme Button */}
          <TouchableOpacity onPress={toggleTheme} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name={isDark ? "sun" : "moon"} size={15} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Forecast')} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="edit-2" size={15} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportPdf} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="download" size={15} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {error !== '' && (
        <View style={[styles.errorCard, { backgroundColor: colors.dangerSoft }]}>
          <Feather name="alert-triangle" size={16} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* Map Section */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>Operations Map</Text>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Disruption Timeline & Propagation Layers</Text>
        </View>

        <View style={[styles.mapContainer, { borderColor: colors.border }]}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            onLoadEnd={injectForecastData}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={styles.webView}
            onError={(e) => console.warn("WebView load error:", e)}
          />
        </View>

        {/* Digital Twin Replay Controls */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.replayTitleRow}>
            <View style={[styles.statusLiveDot, { backgroundColor: colors.cyan400 }]} />
            <Text style={[styles.replayTitle, { color: colors.text }]}>Digital Twin Replay</Text>
          </View>

          {/* Replay Buttons */}
          <View style={styles.replayButtonsRow}>
            <TouchableOpacity onPress={isPlaying ? pause : play} style={[styles.replayPlayButton, { backgroundColor: colors.blue600 }]}>
              <Feather name={isPlaying ? "pause" : "play"} size={16} color="#fff" />
              <Text style={styles.replayPlayButtonText}>{isPlaying ? "Pause" : "Play"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleReset} style={[styles.replayResetButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="rotate-ccw" size={14} color={colors.text} />
              <Text style={[styles.replayResetButtonText, { color: colors.text }]}>Reset</Text>
            </TouchableOpacity>

            {/* Speed selection */}
            <View style={[styles.speedButtonGroup, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              {[1, 2, 4].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSpeed(s)}
                  style={[styles.speedButton, { borderRightColor: colors.border }, speed === s && { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.speedButtonText, { color: colors.textMuted }, speed === s && { color: '#fff', fontWeight: 'bold' }]}>
                    {s}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Replay Details */}
          <View style={[styles.replayStatusPanel, { backgroundColor: colors.surface2, borderLeftColor: colors.cyan400 }]}>
            <View style={styles.replayStatusCol}>
              <Text style={[styles.replayStatusLabel, { color: colors.textSubtle }]}>Current Stage</Text>
              <Text style={[styles.replayStatusVal, { color: colors.text }]} numberOfLines={1}>
                {timelineData?.find(item => item.minute === currentMinute)?.title || 'Incident Start'}
              </Text>
            </View>
            <View style={styles.replayStatusCol}>
              <Text style={[styles.replayStatusLabel, { color: colors.textSubtle }]}>Replay Time</Text>
              <Text style={[styles.replayStatusValColor, { color: colors.cyan400 }]}>{currentMinute} Min</Text>
            </View>
          </View>
        </View>

        {/* KPI Cards Row */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSubtle }]}>RISK LEVEL</Text>
            <Text style={[styles.kpiValue, { color: forecastData?.risk === 'Critical' ? colors.danger : colors.warning }]}>
              {forecastData?.risk}
            </Text>
            <Text style={[styles.kpiSub, { color: colors.textSubtle }]}>{confidence}% confidence</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSubtle }]}>EXPECTED DELAY</Text>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{forecastData?.delay} min</Text>
            <Text style={[styles.kpiSub, { color: colors.textSubtle }]}>Per segment</Text>
          </View>
        </View>

        {/* Strategy Advisor */}
        <StrategyAdvisor forecastData={forecastData} />

        {/* Resource Chart */}
        {forecastData && (
          <ResourceChart
            officers={forecastData.officers}
            barricades={forecastData.barricades}
          />
        )}

        {/* Affected Corridors */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Predicted Corridor Impact</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSubtle }]}>Estimated delays cascading to surrounding corridors.</Text>
          
          <View style={{ marginTop: 12 }}>
            {forecastData?.affected_corridors && forecastData.affected_corridors.map((c, idx) => {
              const barColor = c.risk_level === 'Critical' ? colors.danger :
                               c.risk_level === 'High' || c.risk_level === 'Medium' ? colors.warning :
                               colors.success;
              return (
                <View key={idx} style={styles.affectedRow}>
                  <View style={styles.affectedHeader}>
                    <Text style={[styles.affectedName, { color: colors.textMuted }]} numberOfLines={1}>{c.corridor}</Text>
                    <Text style={[styles.affectedValue, { color: colors.text }]}>{c.delay_min}m delay</Text>
                  </View>
                  <View style={[styles.affectedBarTrack, { backgroundColor: colors.surface2 }]}>
                    <View style={[styles.affectedBarFill, { width: `${c.impact_pct}%`, backgroundColor: barColor }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Scenario Comparison Table */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Scenario Analysis</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSubtle }]}>Compare outcomes with and without road closure.</Text>
          
          <View style={[styles.comparisonTable, { borderColor: colors.border }]}>
            <View style={[styles.compTableRow, styles.compTableHeader, { backgroundColor: colors.surface2, borderBottomColor: colors.border }]}>
              <Text style={[styles.compTableCell, styles.compTableLabelCol, { color: colors.text }]}>Metric</Text>
              <Text style={[styles.compTableCell, { color: colors.textMuted }]}>No Closure</Text>
              <Text style={[styles.compTableCell, { color: colors.textMuted }]}>Closure</Text>
            </View>

            <View style={[styles.compTableRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.compTableCell, styles.compTableLabelCol, { color: colors.text }]}>Risk Score</Text>
              <Text style={[styles.compTableCell, { color: colors.textMuted }]}>{scenarioA?.score.toFixed(1)}</Text>
              <Text style={[styles.compTableCell, { color: colors.textMuted }]}>{scenarioB?.score.toFixed(1)}</Text>
            </View>

            <View style={[styles.compTableRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.compTableCell, styles.compTableLabelCol, { color: colors.text }]}>Risk Tier</Text>
              <Text style={[styles.compTableCell, { color: colors.success }]}>{scenarioA?.risk}</Text>
              <Text style={[styles.compTableCell, { color: colors.danger }]}>{scenarioB?.risk}</Text>
            </View>

            <View style={[styles.compTableRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.compTableCell, styles.compTableLabelCol, { color: colors.text }]}>Clearance</Text>
              <Text style={[styles.compTableCell, { color: colors.textMuted }]}>{scenarioA?.traffic_clearance_min}m</Text>
              <Text style={[styles.compTableCell, { color: colors.textMuted }]}>{scenarioB?.traffic_clearance_min}m</Text>
            </View>

            <View style={styles.compTableRow}>
              <Text style={[styles.compTableCell, styles.compTableLabelCol, { color: colors.text }]}>Officers</Text>
              <Text style={[styles.compTableCell, { color: colors.textMuted }]}>{scenarioA?.officers}</Text>
              <Text style={[styles.compTableCell, { color: colors.textMuted }]}>{scenarioB?.officers}</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 12,
  },
  loadingSubtext: {
    fontSize: 11,
    marginTop: 4,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  sectionHeaderContainer: {
    marginTop: 16,
    marginBottom: 10,
  },
  sectionEyebrow: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  mapContainer: {
    height: 280,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  webView: {
    flex: 1,
    backgroundColor: '#111827',
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  replayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  replayTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  replayButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  replayPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  replayPlayButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  replayResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  replayResetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  speedButtonGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginLeft: 'auto',
  },
  speedButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRightWidth: 1,
  },
  speedButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  replayStatusPanel: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  replayStatusCol: {
    flex: 1,
  },
  replayStatusLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
  },
  replayStatusVal: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  replayStatusValColor: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kpiCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    width: '48%',
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 10,
    marginTop: 2,
  },
  affectedRow: {
    marginBottom: 10,
  },
  affectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  affectedName: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  affectedValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  affectedBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  affectedBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  comparisonTable: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  compTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  compTableHeader: {
    borderBottomWidth: 1,
  },
  compTableCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
  },
  compTableLabelCol: {
    textAlign: 'left',
    fontWeight: '600',
    flex: 1.2,
  },
});
