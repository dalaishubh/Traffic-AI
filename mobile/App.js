import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import LandingScreen from './src/screens/LandingScreen';
import ForecastScreen from './src/screens/ForecastScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import MapScreen from './src/screens/MapScreen';
import ChatButton from './src/components/ChatButton';

const Tab = createBottomTabNavigator();

function NavigationWrapper() {
  const { colors, isDark } = useTheme();

  // Dynamic Navigation Theme
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <View style={[styles.appContainer, { backgroundColor: colors.bg }]}>
      <ExpoStatusBar style={isDark ? "light" : "dark"} />
      <NavigationContainer theme={navigationTheme}>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color, size }) => {
              let iconName;
              if (route.name === 'Home') {
                iconName = 'home';
              } else if (route.name === 'Forecast') {
                iconName = 'sliders';
              } else if (route.name === 'Dashboard') {
                iconName = 'activity';
              } else if (route.name === 'Analytics') {
                iconName = 'bar-chart-2';
              } else if (route.name === 'Map') {
                iconName = 'map';
              }
              return <Feather name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSubtle,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              paddingBottom: 6,
              paddingTop: 6,
              height: 60,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
            headerShown: false,
          })}
        >
          <Tab.Screen name="Home" component={LandingScreen} />
          <Tab.Screen name="Forecast" component={ForecastScreen} />
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Analytics" component={AnalyticsScreen} />
          <Tab.Screen name="Map" component={MapScreen} />
        </Tab.Navigator>
      </NavigationContainer>

      {/* Global Floating AI Chatbot overlay */}
      <ChatButton />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NavigationWrapper />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
  },
});
