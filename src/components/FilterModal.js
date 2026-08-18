// Filter Modal for Home Screen
import React, { useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { AppText } from './ui/AppText';
import { Icon } from './ui/Icon';
import { GENRES } from '../constants/genres';

const LANGUAGES = [
  { id: 'all', label: 'All Languages' },
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi' },
];

const DURATIONS = [
  { id: 'all', label: 'All Duration' },
  { id: 'short', label: 'Short (< 5 min)' },
  { id: 'medium', label: 'Medium (5-15 min)' },
  { id: 'long', label: 'Long (15+ min)' },
];

export const FilterModal = ({ visible, onClose, onApply, initialFilters }) => {
  const { theme } = useTheme();
  const [selectedGenre, setSelectedGenre] = useState(initialFilters?.genre || 'all');
  const [selectedLanguage, setSelectedLanguage] = useState(initialFilters?.language || 'all');
  const [selectedDuration, setSelectedDuration] = useState(initialFilters?.duration || 'all');

  const handleApply = () => {
    onApply({
      genre: selectedGenre === 'all' ? null : selectedGenre,
      language: selectedLanguage === 'all' ? null : selectedLanguage,
      duration: selectedDuration,
    });
    onClose();
  };

  const handleReset = () => {
    // Reset local state
    setSelectedGenre('all');
    setSelectedLanguage('all');
    setSelectedDuration('all');
    // Apply reset to parent (clears filters) and close modal
    onApply(null);
    onClose();
  };

  const FilterSection = ({ title, items, selected, onSelect }) => (
    <View style={styles.section}>
      <AppText variant="label" color="text" style={styles.sectionTitle}>
        {title}
      </AppText>
      <View style={styles.chipRow}>
        {items.map((item) => {
          const isActive = selected === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? theme.accent : theme.card,
                  borderColor: isActive ? theme.accent : theme.border,
                },
              ]}
            >
              <AppText variant="caption" color={isActive ? 'onAccent' : 'text'}>
                {item.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.container, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <AppText variant="h2" color="text">Filter Stories</AppText>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          {/* Filters */}
          <ScrollView style={styles.content}>
            <FilterSection
              title="Genre"
              items={GENRES}
              selected={selectedGenre}
              onSelect={setSelectedGenre}
            />
            <FilterSection
              title="Language"
              items={LANGUAGES}
              selected={selectedLanguage}
              onSelect={setSelectedLanguage}
            />
            <FilterSection
              title="Duration"
              items={DURATIONS}
              selected={selectedDuration}
              onSelect={setSelectedDuration}
            />
          </ScrollView>

          {/* Buttons */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Pressable
              onPress={handleReset}
              style={[styles.button, styles.resetButton, { backgroundColor: theme.card }]}
            >
              <AppText variant="label" color="text">Reset</AppText>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={[styles.button, styles.applyButton, { backgroundColor: theme.accent }]}
            >
              <AppText variant="label" color="onAccent">Apply Filters</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButton: {
    // backgroundColor handled inline
  },
  applyButton: {
    // backgroundColor handled inline
  },
});

export default FilterModal;
