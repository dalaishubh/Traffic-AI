import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const STATS = [
  { value: '8,173', label: 'Historical events analyzed' },
  { value: '22', label: 'Active corridors monitored' },
  { value: '294', label: 'Junction hotspots mapped' },
];

const FEATURES = [
  {
    icon: 'trending-up',
    title: 'Congestion forecasting',
    desc: 'Predict corridor-level delay and risk before an event begins, using historical and contextual signals.',
  },
  {
    icon: 'shield',
    title: 'Risk classification',
    desc: 'Each scenario is scored and tiered (Low to Critical) so dispatchers know exactly when to escalate.',
  },
  {
    icon: 'users',
    title: 'Resource planning',
    desc: 'Get recommended officer counts and barricade units sized to the predicted load — not guesswork.',
  },
  {
    icon: 'bar-chart-2',
    title: 'Scenario comparison',
    desc: 'Compare with-closure vs. without-closure plans side-by-side to support data-backed decisions.',
  },
  {
    icon: 'clock',
    title: 'Forecast history',
    desc: 'Recent simulations are saved locally so planners can review and revisit previous what-if runs.',
  },
  {
    icon: 'map',
    title: 'Spatial overview',
    desc: 'A map-based view of corridors and junctions provides operational context at a glance.',
  },
];

export default function LandingScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 8 }]}>
      
      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerEyebrow, { color: colors.primary }]}>Urban Twin Platform</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Traffic AI Desk</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={[styles.themeToggleButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name={isDark ? "sun" : "moon"} size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.tagBadge, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.tagText, { color: colors.primary }]}>Smart City · Operational Intelligence</Text>
          </View>
          
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Forecast traffic impact{'\n'}
            <Text style={{ color: colors.primary }}>before it happens.</Text>
          </Text>
          
          <Text style={[styles.heroDesc, { color: colors.textSubtle }]}>
            A decision-support platform for city traffic authorities. Simulate events, estimate
            congestion risk, and plan officer and barricade deployment with confidence.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Forecast')}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.primaryButtonText}>Open forecast desk</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Analytics')}
              style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>View analytics</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          {STATS.map((s, idx) => (
            <View key={idx} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSubtle }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Capabilities Title */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Built for traffic operations teams</Text>
          <Text style={[styles.sectionDesc, { color: colors.textSubtle }]}>
            Six focused capabilities that turn raw event parameters into operational plans —
            clear scores, clear actions, clear comparisons.
          </Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          {FEATURES.map((f, idx) => (
            <View key={idx} style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.featureIconContainer, { backgroundColor: colors.primarySoft }]}>
                <Feather name={f.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.featureTitle, { color: colors.text }]}>{f.title}</Text>
              <Text style={[styles.featureDesc, { color: colors.textSubtle }]}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* Bottom CTA Panel */}
        <View style={[styles.ctaCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[styles.ctaTitle, { color: colors.text }]}>Ready to simulate a scenario?</Text>
          <Text style={[styles.ctaDesc, { color: colors.textSubtle }]}>Configure event parameters and get a risk-tiered forecast in seconds.</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Forecast')}
            style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 16, alignSelf: 'stretch', justifyContent: 'center' }]}
          >
            <Text style={styles.primaryButtonText}>Launch forecast desk</Text>
            <Feather name="play" size={14} color="#fff" />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerEyebrow: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  themeToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroSection: {
    marginBottom: 28,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  tagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  heroDesc: {
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 13,
  },
  statsSection: {
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionDesc: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 32,
  },
  featureCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  featureIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  featureDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  ctaCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: 'flex-start',
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ctaDesc: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
});
