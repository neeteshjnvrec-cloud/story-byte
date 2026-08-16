// Settings Panel - Bottom sheet version matching the edit profile style
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';

const Toggle = ({ value, onValueChange, theme }) => (
  <Pressable
    onPress={() => onValueChange(!value)}
    hitSlop={8}
    style={[styles.toggleTrack, { backgroundColor: value ? theme.accent : theme.border }]}
  >
    <View style={[styles.toggleKnob, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
  </Pressable>
);

const GroupLabel = ({ children }) => (
  <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>
    {children}
  </AppText>
);

const Row = ({ theme, icon, label, value, right, onPress, isLast }) => {
  const content = (
    <View style={[styles.row, { borderBottomColor: theme.divider, borderBottomWidth: isLast ? 0 : 1 }]}>
      <View style={styles.rowLeft}>
        <Icon name={icon} size={18} color={theme.accent} />
        <AppText variant="body" color="text">{label}</AppText>
      </View>
      <View style={styles.rowRight}>
        {value != null && <AppText variant="caption" color="textSecondary">{value}</AppText>}
        {right}
      </View>
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>{content}</Pressable>;
  }
  return content;
};

const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
const THEME_CYCLE = { system: 'light', light: 'dark', dark: 'system' };

export const SettingsPanel = ({ onClose }) => {
  const { theme, themeMode, changeTheme } = useTheme();
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);

  const cycleAppearance = () => changeTheme(THEME_CYCLE[themeMode] || 'light');
  const appearanceValue = THEME_LABELS[themeMode] || 'System';
  const chevron = <Icon name="chev-right" size={16} color={theme.textTertiary} />;

  return (
    <View style={[styles.overlay, { backgroundColor: theme.scrim }]}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />

      <View style={[styles.panel, { backgroundColor: theme.surface }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="x" size={20} color={theme.textSecondary} />
          </Pressable>
          <AppText variant="h3">Settings</AppText>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* PLAYBACK */}
          <GroupLabel>PLAYBACK</GroupLabel>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Row theme={theme} icon="speed" label="Default speed" value="1.0×" right={chevron} onPress={() => {}} />
            <Row theme={theme} icon="queue" label="Autoplay next" right={<Toggle theme={theme} value={autoplayNext} onValueChange={setAutoplayNext} />} isLast />
          </View>

          {/* APP */}
          <GroupLabel>APP</GroupLabel>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Row theme={theme} icon="globe" label="Language" value="English" right={chevron} onPress={() => {}} />
            <Row theme={theme} icon="moon" label="Appearance" value={appearanceValue} right={chevron} onPress={cycleAppearance} />
            <Row theme={theme} icon="download" label="Wi-Fi only downloads" right={<Toggle theme={theme} value={wifiOnly} onValueChange={setWifiOnly} />} isLast />
          </View>

          {/* MODES */}
          <GroupLabel>MODES</GroupLabel>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Row theme={theme} icon="star" label="Sleep mode" right={chevron} onPress={() => Alert.alert('Sleep mode', 'Coming soon.')} />
            <Row theme={theme} icon="lock" label="Kids mode" right={chevron} onPress={() => Alert.alert('Kids mode', 'Coming soon.')} isLast />
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  panel: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  groupLabel: {
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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

export default SettingsPanel;
