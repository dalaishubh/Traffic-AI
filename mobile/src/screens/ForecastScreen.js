import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getCorridors, getJunctions } from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

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

export default function ForecastScreen({ navigation }) {
  const [corridors, setCorridors] = useState([]);
  const [junctions, setJunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [eventType, setEventType] = useState('public_event');
  const [attendance, setAttendance] = useState('2500');
  const [duration, setDuration] = useState('3');
  const [selectedCorridor, setSelectedCorridor] = useState('');
  const [selectedJunction, setSelectedJunction] = useState('');
  const [roadClosure, setRoadClosure] = useState(false);
  const [startHour, setStartHour] = useState(18);

  const [showEventSelect, setShowEventSelect] = useState(false);
  const [showHourSelect, setShowHourSelect] = useState(false);

  const { colors, isDark, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  useEffect(() => {
    (async () => {
      try {
        const [c, j] = await Promise.all([getCorridors(), getJunctions()]);
        setCorridors(c);
        setJunctions(j);
        if (c.length) setSelectedCorridor(c[0]);
        if (j.length) setSelectedJunction(j[0]);
        setLoading(false);
      } catch (err) {
        setError('Failed to load corridors and junctions from backend API.');
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!selectedCorridor || !selectedJunction) {
      setError('Select both a corridor and a junction to run a simulation.');
      return;
    }
    setError('');

    const formData = {
      event_type: eventType,
      attendance: Number(attendance) || 0,
      duration_hours: Number(duration) || 1,
      corridor: selectedCorridor,
      junction: selectedJunction,
      road_closure: roadClosure,
      start_hour: Number(startHour),
    };

    try {
      await AsyncStorage.setItem('forecast_form_data', JSON.stringify(formData));
      navigation.navigate('Dashboard', { refresh: Date.now() });
    } catch (e) {
      setError('Failed to save simulation parameters.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading simulator components...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Forecast Desk</Text>
          <Text style={styles.title}>Predictive Simulation</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={styles.themeToggleButton}>
          <Feather name={isDark ? "sun" : "moon"} size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.desc}>
          Configure an event and generate a risk-tiered traffic forecast for the selected corridor.
        </Text>

        {error !== '' && (
          <View style={styles.errorCard}>
            <Feather name="alert-triangle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.card}>
          {/* Event Type selector trigger */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Event type</Text>
            <TouchableOpacity
              onPress={() => setShowEventSelect(!showEventSelect)}
              style={styles.dropdownTrigger}
            >
              <Text style={styles.dropdownValue}>
                {EVENT_TYPES.find((t) => t.value === eventType)?.label || eventType}
              </Text>
              <Feather name={showEventSelect ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSubtle} />
            </TouchableOpacity>
            {showEventSelect && (
              <View style={styles.dropdownOptions}>
                {EVENT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => {
                      setEventType(t.value);
                      setShowEventSelect(false);
                    }}
                    style={[styles.dropdownOption, eventType === t.value && styles.dropdownOptionSelected]}
                  >
                    <Text style={[styles.dropdownOptionText, eventType === t.value && styles.dropdownOptionTextSelected]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Start Hour selector trigger */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start hour</Text>
            <TouchableOpacity
              onPress={() => setShowHourSelect(!showHourSelect)}
              style={styles.dropdownTrigger}
            >
              <Text style={styles.dropdownValue}>
                {String(startHour).padStart(2, '0')}:00
              </Text>
              <Feather name={showHourSelect ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSubtle} />
            </TouchableOpacity>
            {showHourSelect && (
              <View style={[styles.dropdownOptions, { maxHeight: 150 }]}>
                <ScrollView nestedScrollEnabled>
                  {Array.from({ length: 24 }, (_, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        setStartHour(i);
                        setShowHourSelect(false);
                      }}
                      style={[styles.dropdownOption, startHour === i && styles.dropdownOptionSelected]}
                    >
                      <Text style={[styles.dropdownOptionText, startHour === i && styles.dropdownOptionTextSelected]}>
                        {String(i).padStart(2, '0')}:00
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Expected Attendance */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Expected attendance</Text>
            <TextInput
              keyboardType="number-pad"
              value={attendance}
              onChangeText={setAttendance}
              style={styles.input}
              placeholder="e.g. 2500"
              placeholderTextColor={colors.textSubtle}
            />
          </View>

          {/* Duration */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Duration (hours)</Text>
            <TextInput
              keyboardType="number-pad"
              value={duration}
              onChangeText={setDuration}
              style={styles.input}
              placeholder="e.g. 3"
              placeholderTextColor={colors.textSubtle}
            />
          </View>

          {/* Corridor Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Corridor</Text>
            <SearchableSelect
              options={corridors}
              value={selectedCorridor}
              onChange={setSelectedCorridor}
              placeholder="Select corridor"
            />
          </View>

          {/* Junction Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Junction</Text>
            <SearchableSelect
              options={junctions}
              value={selectedJunction}
              onChange={setSelectedJunction}
              placeholder="Select junction"
            />
          </View>

          {/* Road Closure switch */}
          <View style={styles.switchGroup}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.switchLabel}>Road closure in effect</Text>
              <Text style={styles.switchDesc}>forces reroutes through alternates</Text>
            </View>
            <Switch
              value={roadClosure}
              onValueChange={setRoadClosure}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
            />
          </View>

          {/* Run button */}
          <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
            <Feather name="play" size={16} color="#fff" />
            <Text style={styles.submitButtonText}>Run Forecast</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: colors.textSubtle,
    fontSize: 13,
    marginTop: 12,
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
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textSubtle,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 14,
    height: 44,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    height: 44,
  },
  dropdownValue: {
    color: colors.text,
    fontSize: 14,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.primarySoft,
  },
  dropdownOptionText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  dropdownOptionTextSelected: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  switchDesc: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 2,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
