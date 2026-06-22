import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Modal, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ChatWindow from './ChatWindow';

export default function ChatButton() {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        activeOpacity={0.8}
      >
        <Feather name="message-square" size={20} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <ChatWindow onClose={() => setOpen(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 110, // Positioned comfortably above the 60px bottom tab bar to prevent overlap with the Map tab
    right: 16,
    zIndex: 999,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
});
