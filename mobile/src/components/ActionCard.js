import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const getIcon = (text, colors) => {
  const t = text.toLowerCase();
  if (t.includes("officer") || t.includes("personnel")) {
    return <Feather name="users" size={18} color={colors.cyan400} />;
  }
  if (t.includes("barricade") || t.includes("junction") || t.includes("block")) {
    return <Feather name="shield" size={18} color={colors.amber400} />;
  }
  if (t.includes("diversion") || t.includes("route")) {
    return <Feather name="map-pin" size={18} color={colors.indigo400} />;
  }
  if (t.includes("advisory") || t.includes("broadcast") || t.includes("signage")) {
    return <Feather name="volume-2" size={18} color={colors.success} />;
  }
  if (t.includes("escalate") || t.includes("command") || t.includes("critical")) {
    return <Feather name="alert-triangle" size={18} color={colors.danger} />;
  }
  return <Feather name="check-square" size={18} color={colors.primary} />;
};

export default function ActionCard({ action, index }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const stepNumber = String(index + 1).padStart(2, "0");
  
  return (
    <View style={styles.card}>
      {/* Step Number Badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{stepNumber}</Text>
      </View>

      {/* Icon Wrapper */}
      <View style={styles.iconContainer}>
        {getIcon(action, colors)}
      </View>

      {/* Action Content */}
      <View style={styles.contentContainer}>
        <Text style={styles.actionText}>{action}</Text>
        <Text style={styles.subtitleText}>Tactical Objective</Text>
      </View>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  badgeText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
    color: colors.textSubtle,
  },
  iconContainer: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  actionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  subtitleText: {
    color: colors.textSubtle,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
