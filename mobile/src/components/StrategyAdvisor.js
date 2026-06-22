import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ActionCard from './ActionCard';
import { useTheme } from '../context/ThemeContext';

export default function StrategyAdvisor({ forecastData }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  if (!forecastData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No operational data available.</Text>
      </View>
    );
  }

  const strategy = forecastData.strategy || {};
  const priority = strategy.priority || "Low";
  const actions = strategy.actions || [];
  const deploymentPlan = strategy.deployment_plan || [];
  const diversion = strategy.diversion || { primary: "N/A", secondary: "N/A", emergency: "N/A" };
  const estimatedImprovement = strategy.estimated_improvement || "0%";

  // Determine priority color themes
  let theme = {
    color: colors.success,
    bg: colors.successSoft,
    border: colors.border,
    badgeBg: colors.successSoft,
    pulse: colors.success,
    complexity: "Routine Monitoring"
  };

  if (priority.toLowerCase() === "critical") {
    theme = {
      color: colors.danger,
      bg: colors.dangerSoft,
      border: colors.border,
      badgeBg: colors.dangerSoft,
      pulse: colors.danger,
      complexity: "Critical Action Plan"
    };
  } else if (priority.toLowerCase() === "high") {
    theme = {
      color: '#f97316', // orange-400
      bg: 'rgba(249, 115, 22, 0.1)',
      border: colors.border,
      badgeBg: 'rgba(249, 115, 22, 0.15)',
      pulse: '#f97316',
      complexity: "High Command Control"
    };
  } else if (priority.toLowerCase() === "medium") {
    theme = {
      color: colors.warning,
      bg: colors.warningSoft,
      border: colors.border,
      badgeBg: colors.warningSoft,
      pulse: colors.warning,
      complexity: "Standard Diversion"
    };
  }

  return (
    <View style={styles.container}>
      {/* Active Strategy Header */}
      <View style={[styles.headerPanel, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.pulseCircle, { backgroundColor: theme.pulse }]} />
          <View>
            <Text style={styles.headerTitle}>Active Strategy Engine</Text>
            <Text style={styles.headerSubtitle}>Deterministic Decision Support Recommendation</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerScoreLabel}>Risk Score</Text>
          <Text style={styles.headerScoreText}>{forecastData.score} / 100</Text>
        </View>
      </View>

      {/* KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        {/* KPI 1: Priority */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>Priority Level</Text>
            <Feather name="alert-circle" size={13} color={colors.textSubtle} />
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: theme.badgeBg, borderColor: theme.border }]}>
            <Text style={[styles.priorityBadgeText, { color: theme.color }]}>{priority}</Text>
          </View>
        </View>

        {/* KPI 2: Complexity */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>Complexity</Text>
            <Feather name="layers" size={13} color={colors.textSubtle} />
          </View>
          <View style={{ marginTop: 6 }}>
            <Text style={styles.kpiValueText} numberOfLines={1}>{theme.complexity}</Text>
            <Text style={styles.kpiSublabel}>Control Tier</Text>
          </View>
        </View>

        {/* KPI 3: Recommended Personnel */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>Personnel</Text>
            <Feather name="briefcase" size={13} color={colors.textSubtle} />
          </View>
          <View style={{ marginTop: 6 }}>
            <Text style={[styles.kpiValueText, { color: colors.cyan400 }]}>
              {forecastData.officers || 0} Officers
            </Text>
            <Text style={styles.kpiSublabel}>Field Deployments</Text>
          </View>
        </View>

        {/* KPI 4: Expected Delay Reduction */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>Delay Reduc.</Text>
            <Feather name="trending-down" size={13} color={colors.textSubtle} />
          </View>
          <View style={{ marginTop: 6 }}>
            <Text style={[styles.kpiValueText, { color: colors.success }]}>
              {estimatedImprovement}
            </Text>
            <Text style={styles.kpiSublabel}>Expected Improvement</Text>
          </View>
        </View>
      </View>

      {/* Recommended Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: colors.cyan400 }]} />
          <Text style={styles.sectionTitle}>Recommended Actions</Text>
        </View>
        <View style={styles.actionsList}>
          {actions.length > 0 ? (
            actions.map((act, index) => (
              <ActionCard key={index} action={act} index={index} />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No actions required.</Text>
            </View>
          )}
        </View>
      </View>

      {/* Resource Deployment */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: colors.indigo400 }]} />
          <Text style={styles.sectionTitle}>Resource Deployment</Text>
        </View>
        <View style={styles.planCard}>
          {deploymentPlan.length > 0 ? (
            deploymentPlan.map((plan, i) => (
              <View key={i} style={styles.planItem}>
                <View style={styles.planDot} />
                <Text style={styles.planText}>{plan}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.planEmptyText}>No special resources needed.</Text>
          )}
        </View>
      </View>

      {/* Diversion Route Intelligence */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: colors.amber400 }]} />
          <Text style={styles.sectionTitle}>Diversion Intelligence</Text>
        </View>
        <View style={styles.diversionCard}>
          {/* Primary Route */}
          <View style={styles.diversionItem}>
            <Text style={styles.diversionLabel}>Primary Route</Text>
            <Text style={styles.diversionValuePrimary}>{diversion.primary || "N/A"}</Text>
          </View>
          
          {/* Secondary Route */}
          <View style={[styles.diversionItem, styles.diversionBorder]}>
            <Text style={styles.diversionLabel}>Secondary Route</Text>
            <Text style={styles.diversionValueSecondary}>{diversion.secondary || "N/A"}</Text>
          </View>

          {/* Emergency Bypass */}
          <View style={[styles.diversionItem, styles.diversionBorder]}>
            <Text style={styles.diversionLabel}>Emergency Route</Text>
            <Text style={[
              styles.diversionValueEmergency,
              diversion.emergency !== "N/A" && { color: colors.danger }
            ]}>
              {diversion.emergency || "N/A"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    marginTop: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  headerPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pulseCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 9,
    color: colors.textSubtle,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerScoreLabel: {
    fontSize: 8,
    color: colors.textSubtle,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  headerScoreText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    justifyContent: 'space-between',
    minHeight: 70,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textSubtle,
    textTransform: 'uppercase',
  },
  priorityBadge: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  kpiValueText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  kpiSublabel: {
    fontSize: 9,
    color: colors.textSubtle,
    marginTop: 2,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingLeft: 2,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsList: {
    marginTop: 4,
  },
  emptyCard: {
    padding: 16,
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  emptyCardText: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  planCard: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  planItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cyan400,
    marginTop: 6,
    marginRight: 8,
    flexShrink: 0,
  },
  planText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    flex: 1,
  },
  planEmptyText: {
    fontSize: 12,
    color: colors.textSubtle,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  diversionCard: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  diversionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  diversionBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  diversionLabel: {
    fontSize: 10,
    color: colors.textSubtle,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  diversionValuePrimary: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.indigo400,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  diversionValueSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  diversionValueEmergency: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textSubtle,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
});
