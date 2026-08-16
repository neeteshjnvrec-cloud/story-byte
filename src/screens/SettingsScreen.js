// Settings Screen for Story Byte
// Theme toggle, language, notifications preferences
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Platform
} from 'react-native';
import { useTheme } from '../hooks/useTheme';

export const SettingsScreen = () => {
  const { theme, themeMode, changeTheme, isDark } = useTheme();

  const themeOptions = [
    { key: 'light', label: 'Light', icon: '☀️' },
    { key: 'dark', label: 'Dark', icon: '🌙' },
    { key: 'system', label: 'System', icon: '📱' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Manage your StoryByte preferences</Text>
      </View>

      {/* Theme Section */}
      <View style={[styles.section, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>

        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.settingItem,
              themeMode === option.key && { backgroundColor: theme.surface }
            ]}
            onPress={() => changeTheme(option.key)}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>{option.icon}</Text>
              <Text style={[styles.settingText, { color: theme.text }]}>{option.label}</Text>
            </View>
            {themeMode === option.key && (
              <Text style={[styles.checkmark, { color: theme.accent }]}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Notifications Section */}
      <View style={[styles.section, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Notifications</Text>

        <View style={[styles.settingItem, { justifyContent: 'space-between' }]}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingIcon}>🔔</Text>
            <Text style={[styles.settingText, { color: theme.text }]}>Daily reminders</Text>
          </View>
          <Switch
            value={true}
            onValueChange={() => {}}
            trackColor={{ false: '#767577', true: theme.accent }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.settingItem, { justifyContent: 'space-between' }]}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingIcon}>🎧</Text>
            <Text style={[styles.settingText, { color: theme.text }]}>New story alerts</Text>
          </View>
          <Switch
            value={true}
            onValueChange={() => {}}
            trackColor={{ false: '#767577', true: theme.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Language Section */}
      <View style={[styles.section, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Language</Text>

        {['English', 'Hindi', 'Spanish'].map((lang) => (
          <TouchableOpacity key={lang} style={styles.settingItem}>
            <Text style={[styles.settingText, { color: theme.text }]}>{lang}</Text>
            {lang === 'English' && (
              <Text style={[styles.checkmark, { color: theme.accent }]}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={[styles.settingText, { color: theme.text }]}>Privacy Policy</Text>
          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={[styles.settingText, { color: theme.text }]}>Terms of Service</Text>
          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>→</Text>
        </TouchableOpacity>

        <View style={styles.settingItem}>
          <Text style={[styles.settingText, { color: theme.text }]}>Version</Text>
          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8b9dc3',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    fontSize: 22,
  },
  settingText: {
    fontSize: 16,
  },
  settingValue: {
    fontSize: 16,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;