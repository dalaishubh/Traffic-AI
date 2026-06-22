import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView, Platform, StatusBar, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { getMapJunctions } from '../services/api';
import { getLiveJunctionsMapHtml } from '../assets/gridlockDashboardHtml';

export default function MapScreen() {
  const [junctions, setJunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getMapJunctions();
      setJunctions(data || []);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load map junctions:", err);
      setError('Unable to load live traffic hotspots from API.');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const mapHtml = getLiveJunctionsMapHtml(junctions);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Live Operations Map</Text>
          <Text style={styles.title}>Traffic Risk Map</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={styles.themeToggleButton}>
          <Feather name={isDark ? "sun" : "moon"} size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Legend Row */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Low Risk</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>Medium Risk</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
          <Text style={styles.legendText}>High Risk</Text>
        </View>
      </View>

      {error !== '' && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Rendering risk layers...</Text>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <WebView
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={styles.webView}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 8,
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
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    padding: 10,
    alignItems: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 10,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
  webView: {
    flex: 1,
    backgroundColor: '#111827',
  },
});
