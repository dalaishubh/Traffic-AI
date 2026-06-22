import React, { createContext, useContext, useState } from 'react';

export const LightColors = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#64748B',
  primary: '#2563EB',
  primarySoft: '#DBEAFE',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  slate800: '#CBD5E1',
  slate900: '#F8FAFC',
  slate950: '#F1F5F9',
  cyan400: '#06b6d4',
  indigo400: '#4f46e5',
  amber400: '#d97706',
  yellow500: '#ca8a04',
  purple500: '#9333ea',
  blue500: '#2563eb',
  blue600: '#1d4ed8',
};

export const DarkColors = {
  bg: '#0F172A',
  surface: '#1E293B',
  surface2: '#172033',
  border: '#243049',
  borderStrong: '#334155',
  text: '#F8FAFC',
  textMuted: '#CBD5E1',
  textSubtle: '#94A3B8',
  primary: '#3B82F6',
  primarySoft: 'rgba(59, 130, 246, 0.15)',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.15)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.15)',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#020617',
  cyan400: '#22d3ee',
  indigo400: '#818cf8',
  amber400: '#fbbf24',
  yellow500: '#eab308',
  purple500: '#a855f7',
  blue500: '#3b82f6',
  blue600: '#2563eb',
};

const ThemeContext = createContext({
  colors: DarkColors,
  isDark: true,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export const ThemeColors = DarkColors; // Fallback export for static references
