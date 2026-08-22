// Filter Modal for Home Screen
import React, { useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { AppText } from './ui/AppText';
import { Icon } from './ui/Icon';
import { GENRES } from '../constants/genres';

const LANGUAGES = [
  { id: 'all', label: 'All Languages' },
  { id: 'hi', label: 'हिन्दी (Hindi)' },
  { id: 'bn', label: 'বাংলা (Bengali)' },
  { id: 'mr', label: 'मराठी (Marathi)' },
  { id: 'te', label: 'తెలుగు (Telugu)' },
  { id: 'ta', label: 'தமிழ் (Tamil)' },
  { id: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { id: 'ur', label: 'اردو (Urdu)' },
  { id: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { id: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
  { id: 'ml', label: 'മലയാളം (Malayalam)' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español (Spanish)' },
  { id: 'fr', label: 'Français (French)' },
  { id: 'de', label: 'Deutsch (German)' },
  { id: 'it', label: 'Italiano (Italian)' },
  { id: 'pt', label: 'Português (Portuguese)' },
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
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');

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
            <View style={styles.section}>
              <AppText variant="label" color="text" style={styles.sectionTitle}>Language</AppText>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => { setLangSearch(''); setLangPickerOpen(true); }}
              >
                <AppText variant="caption" color="text">
                  {LANGUAGES.find((l) => l.id === selectedLanguage)?.label || 'All Languages'}
                </AppText>
                <Icon name="chev-down" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <FilterSection
              title="Duration"
              items={DURATIONS}
              selected={selectedDuration}
              onSelect={setSelectedDuration}
            />
          </ScrollView>

          {/* Language dropdown sub-modal */}
          <Modal visible={langPickerOpen} transparent animationType="fade" onRequestClose={() => setLangPickerOpen(false)}>
            <Pressable style={[styles.dropdownOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={() => setLangPickerOpen(false)}>
              <View style={[styles.dropdownSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, marginHorizontal: 12, marginBottom: 8, fontSize: 14, paddingVertical: 10 }]}
                  placeholder="Search language…"
                  placeholderTextColor={theme.textSecondary}
                  value={langSearch}
                  onChangeText={setLangSearch}
                  autoFocus
                />
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {LANGUAGES.filter((l) => {
                    const q = (langSearch || '').toLowerCase();
                    if (!q) return true;
                    return l.label.toLowerCase().includes(q) || l.id.toLowerCase().includes(q);
                  }).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.langRow, { borderBottomColor: theme.border }]}
                      onPress={() => { setSelectedLanguage(item.id); setLangPickerOpen(false); setLangSearch(''); }}
                    >
                      <AppText variant="body" color={selectedLanguage === item.id ? 'accent' : 'text'}>{item.label}</AppText>
                      {selectedLanguage === item.id && <Icon name="checkmark" size={18} color={theme.accent} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

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
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  dropdownOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  dropdownSheet: {
    maxHeight: 420,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  langRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    fontSize: 14,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
});

export default FilterModal;
