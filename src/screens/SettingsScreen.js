// Settings Screen for Story Byte
// Warm "storybook" design built entirely on the shared design system.
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';

// Inline pill toggle — 44x26 track, 20x20 knob. ON = accent, OFF = border.
const Toggle = ({ value, onValueChange, theme }) => (
  <Pressable
    onPress={() => onValueChange(!value)}
    hitSlop={8}
    style={[
      styles.toggleTrack,
      { backgroundColor: value ? theme.accent : theme.border },
    ]}
  >
    <View
      style={[
        styles.toggleKnob,
        { alignSelf: value ? 'flex-end' : 'flex-start' },
      ]}
    />
  </Pressable>
);

// Small uppercase group heading.
const GroupLabel = ({ children }) => (
  <AppText
    variant="micro"
    color="textTertiary"
    style={styles.groupLabel}
  >
    {children}
  </AppText>
);

// A single row: accent icon + label on the left, value/chevron or toggle on the right.
const Row = ({ theme, icon, label, value, right, onPress, isLast }) => {
  const content = (
    <View
      style={[
        styles.row,
        { borderBottomColor: theme.divider, borderBottomWidth: isLast ? 0 : 1 },
      ]}
    >
      <View style={styles.rowLeft}>
        <Icon name={icon} size={20} color={theme.accent} />
        <AppText variant="body" color="text">{label}</AppText>
      </View>
      <View style={styles.rowRight}>
        {value != null && (
          <AppText variant="caption" color="textSecondary">{value}</AppText>
        )}
        {right}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
};

// Grouped card wrapper.
const Group = ({ theme, label, children }) => (
  <View style={styles.group}>
    <GroupLabel>{label}</GroupLabel>
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {children}
    </View>
  </View>
);

const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
const THEME_CYCLE = { system: 'light', light: 'dark', dark: 'system' };

export const SettingsScreen = () => {
  const { theme, themeMode, changeTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [autoplayNext, setAutoplayNext] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);

  // Preserved logic: cycle System → Light → Dark and persist via changeTheme.
  const cycleAppearance = () => changeTheme(THEME_CYCLE[themeMode] || 'light');
  const appearanceValue = THEME_LABELS[themeMode] || 'System';

  const chevron = <Icon name="chev-right" size={18} color={theme.textTertiary} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.headerSide}
        >
          <Icon name="chev-left" size={26} color={theme.text} />
        </Pressable>
        <AppText variant="h3" color="text">Settings</AppText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* PLAYBACK */}
        <Group theme={theme} label="PLAYBACK">
          <Row
            theme={theme}
            icon="speed"
            label="Default speed"
            value="1.0×"
            right={chevron}
            onPress={() => {}}
          />
          <Row
            theme={theme}
            icon="queue"
            label="Autoplay next"
            right={<Toggle theme={theme} value={autoplayNext} onValueChange={setAutoplayNext} />}
            isLast
          />
        </Group>

        {/* APP */}
        <Group theme={theme} label="APP">
          <Row
            theme={theme}
            icon="globe"
            label="Language"
            value="English"
            right={chevron}
            onPress={() => {}}
          />
          <Row
            theme={theme}
            icon="moon"
            label="Appearance"
            value={appearanceValue}
            right={chevron}
            onPress={cycleAppearance}
          />
          <Row
            theme={theme}
            icon="download"
            label="Downloads over Wi-Fi only"
            right={<Toggle theme={theme} value={wifiOnly} onValueChange={setWifiOnly} />}
            isLast
          />
        </Group>

        {/* MODES */}
        <Group theme={theme} label="MODES">
          <Row
            theme={theme}
            icon="star"
            label="Sleep mode"
            right={chevron}
            onPress={() => Alert.alert('Sleep mode', 'Coming soon.')}
          />
          <Row
            theme={theme}
            icon="lock"
            label="Kids mode"
            right={chevron}
            onPress={() => Alert.alert('Kids mode', 'Coming soon.')}
            isLast
          />
        </Group>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerSide: {
    width: 40,
    alignItems: 'flex-start',
  },
  group: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  groupLabel: {
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
});

export default SettingsScreen;
