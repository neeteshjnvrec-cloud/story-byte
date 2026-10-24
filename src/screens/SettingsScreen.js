// Settings Screen for Story Byte
// Warm "storybook" design built entirely on the shared design system.
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { useAppContext } from '../context/AppContext';
import apiService from '../services/api';
import { auth, deleteUser } from '../services/firebase';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { openPlayStore } from '../utils/askForRating';
import { WHATSAPP_CHANNEL_URL, TELEGRAM_CHANNEL_URL } from '../constants/links';

// Tapping a row steps to the next option, like Appearance.
const SPEED_STEPS = [0.75, 1, 1.25, 1.5, 2];
const LANGUAGE_STEPS = ['All', 'HI', 'EN'];
const LANGUAGE_LABELS = { All: 'All languages', HI: 'हिंदी', EN: 'English' };
const nextOf = (list, value) => list[(list.indexOf(value) + 1) % list.length];

// Inline pill toggle
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

const GroupLabel = ({ children }) => (
  <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>
    {children}
  </AppText>
);

const Row = ({ theme, icon, label, value, right, onPress, isLast, danger }) => {
  const content = (
    <View
      style={[
        styles.row,
        { borderBottomColor: theme.divider, borderBottomWidth: isLast ? 0 : 1 },
      ]}
    >
      <View style={styles.rowLeft}>
        <Icon name={icon} size={20} color={danger ? theme.error : theme.accent} />
        <AppText variant="body" color={danger ? 'error' : 'text'}>{label}</AppText>
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

// Grouped card wrapper
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
  const { theme, themeMode, changeTheme, setMode, mode } = useTheme() || { theme: {} };
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  // autoplayNext / wifiOnly live in AppContext (and AsyncStorage) — they used
  // to be local state here, so flipping either toggle changed nothing but the
  // switch graphic.
  const {
    user, signOut, autoplayNext, setAutoplayNext, wifiOnly, setWifiOnly,
    defaultSpeed, setDefaultSpeed, storyLanguage, setStoryLanguage,
  } = useAppContext();

  const [deleting, setDeleting] = useState(false);

  const cycleAppearance = () => changeTheme(THEME_CYCLE[themeMode] || 'light');
  const appearanceValue = THEME_LABELS[themeMode] || 'System';
  const chevron = <Icon name="chev-right" size={18} color={theme.textTertiary} />;

  // The devotional WhatsApp Channel (same link the pipeline puts in every post).
  const openWhatsAppChannel = () => {
    Linking.openURL(WHATSAPP_CHANNEL_URL).catch(() => {
      Alert.alert('WhatsApp', `Could not open WhatsApp. Visit ${WHATSAPP_CHANNEL_URL}`);
    });
  };
  const openTelegramChannel = () => {
    Linking.openURL(TELEGRAM_CHANNEL_URL).catch(() => {
      Alert.alert('Telegram', `Could not open Telegram. Visit ${TELEGRAM_CHANNEL_URL}`);
    });
  };

  // Open privacy policy URL
  const openPrivacyPolicy = () => {
    Linking.openURL('https://storybyte-76716.web.app/privacy.html').catch(() => {
      Alert.alert('Privacy Policy', 'Could not open link. Please visit storybyte-76716.web.app/privacy.html');
    });
  };

  // Delete account flow. Firebase only deletes a sign-in account right after
  // a fresh sign-in, so someone signed in a while ago is asked to sign in
  // again first — otherwise their data would go but the account would stay.
  const signedInRecently = () => {
    const at = Date.parse(auth.currentUser?.metadata?.lastSignInTime || '');
    return Number.isFinite(at) && Date.now() - at < 4 * 60 * 1000;
  };

  const askToSignInAgain = () => Alert.alert(
    'Sign in again to continue',
    'For your security, sign in again right before deleting your account. Sign out, sign back in, then tap Delete account.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => signOut().catch(() => {}) },
    ]
  );

  const handleDeleteAccount = () => {
    if (!signedInRecently()) return askToSignInAgain();
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Are you sure?',
              'Type "DELETE" in your mind and tap Confirm. Your account, listening history, favorites, and profile will be permanently removed.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: performDelete,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const performDelete = async () => {
    try {
      setDeleting(true);

      // 1. Archive to deleted_users + delete Firestore data
      await apiService.archiveAndDeleteUser();

      // 2. Delete the sign-in account itself, so the email can't sign back in.
      try {
        await deleteUser(auth.currentUser);
      } catch (err) {
        if (err?.code !== 'auth/requires-recent-login') throw err;
        setDeleting(false);
        return askToSignInAgain();
      }

      // 3. Clear the app's signed-in state.
      await signOut().catch(() => {});

      Alert.alert(
        'Account Deleted',
        'Your account and its data have been deleted.'
      );
    } catch (err) {
      console.error('Delete account error:', err);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

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
            value={`${defaultSpeed}×`}
            right={chevron}
            onPress={() => setDefaultSpeed(nextOf(SPEED_STEPS, defaultSpeed))}
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
            label="Story language"
            value={LANGUAGE_LABELS[storyLanguage] || LANGUAGE_LABELS.All}
            right={chevron}
            onPress={() => setStoryLanguage(nextOf(LANGUAGE_STEPS, storyLanguage))}
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
            icon="moon"
            label="Sleep mode"
            right={mode === 'sleep' ? <Icon name="check" size={16} color={theme.accent} /> : chevron}
            onPress={() => setMode(mode === 'sleep' ? 'normal' : 'sleep')}
          />
          <Row
            theme={theme}
            icon="lock"
            label="Kids mode"
            right={mode === 'kids' ? <Icon name="check" size={16} color={theme.accent} /> : chevron}
            onPress={() => setMode(mode === 'kids' ? 'normal' : 'kids')}
            isLast
          />
        </Group>

        {/* FEEDBACK */}
        <Group theme={theme} label="FEEDBACK">
          <Row
            theme={theme}
            icon="whatsapp"
            label="Daily katha on WhatsApp"
            right={chevron}
            onPress={openWhatsAppChannel}
          />
          <Row
            theme={theme}
            icon="telegram"
            label="Daily katha on Telegram"
            right={chevron}
            onPress={openTelegramChannel}
          />
          <Row
            theme={theme}
            icon="star-outline"
            label="Rate StoryByte"
            right={chevron}
            onPress={openPlayStore}
            isLast
          />
        </Group>

        {/* LEGAL */}
        <Group theme={theme} label="LEGAL">
          <Row
            theme={theme}
            icon="globe"
            label="Privacy Policy"
            right={chevron}
            onPress={openPrivacyPolicy}
            isLast
          />
        </Group>

        {/* ACCOUNT */}
        {!user ? (
          <Group theme={theme} label="ACCOUNT">
            <Row
              theme={theme}
              icon="user"
              label="Sign in or create account"
              right={chevron}
              onPress={() => navigation.navigate('Login')}
              isLast
            />
          </Group>
        ) : (
        <Group theme={theme} label="ACCOUNT">
          <Row
            theme={theme}
            icon="lock"
            label="Sign out"
            right={chevron}
            onPress={async () => {
              try { await signOut(); } catch (e) { console.error(e); }
            }}
          />
          <Row
            theme={theme}
            icon="close"
            label={deleting ? 'Deleting...' : 'Delete account'}
            right={deleting ? null : chevron}
            onPress={deleting ? null : handleDeleteAccount}
            danger
            isLast
          />
        </Group>
        )}
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
