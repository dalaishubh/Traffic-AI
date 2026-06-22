import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, TextInput, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const SearchableSelect = ({ options = [], value, onChange, placeholder = 'Select…' }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={styles.triggerButton}
      >
        <Text style={[styles.triggerText, !value && styles.placeholderText]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.textSubtle} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{placeholder}</Text>
            <TouchableOpacity onPress={() => { setModalVisible(false); setQuery(''); }} style={styles.closeButton}>
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Feather name="search" size={16} color={colors.textSubtle} style={styles.searchIcon} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search options..."
              placeholderTextColor={colors.textSubtle}
              style={styles.searchInput}
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No matches found</Text>
            }
            renderItem={({ item }) => {
              const isSelected = value === item;
              return (
                <TouchableOpacity
                  onPress={() => {
                    onChange(item);
                    setModalVisible(false);
                    setQuery('');
                  }}
                  style={[styles.itemButton, isSelected && styles.selectedItemButton]}
                >
                  <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                    {item}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  triggerText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  placeholderText: {
    color: colors.textSubtle,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    margin: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    height: '100%',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyText: {
    color: colors.textSubtle,
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
  },
  itemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedItemButton: {
    backgroundColor: colors.primarySoft,
  },
  itemText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  selectedItemText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});

export default SearchableSelect;
