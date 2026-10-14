// Profile Screen for Story Byte — warm storybook layout with inline editing.
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import apiService from '../services/api';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { CompactRow } from '../components/story/StoryCard';
import { ProfileInfoCard } from '../components/profile/ProfileInfoCard';

export const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, signOut, userStats, loading: contextLoading } = useAppContext();
  const { theme } = useTheme() || { theme: {} };
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  // Cache for user data to prevent redundant fetches
  const [statsCache, setStatsCache] = useState(null);
  const [historyCache, setHistoryCache] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // Refresh stats every time the tab gains focus (so numbers update live).
  // Only fetch if data is stale (older than 30 seconds)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        const now = Date.now();
        if (now - lastFetchTime > 30000) {
          loadUserData();
        }
      }
    }, [user, lastFetchTime])
  );

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userStatsData = await apiService.getUserStats();
      // Only the 5 shown under Recently played.
      const userHistory = await apiService.getUserProgress({ max: 5 });

      setStats(userStatsData);
      setHistory(userHistory || []);
      setStatsCache(userStatsData);
      setHistoryCache(userHistory || []);
      setLastFetchTime(Date.now());
    } catch (error) {
      console.error('Error loading user data:', error);
      // Use cached data on error
      if (statsCache) setStats(statsCache);
      if (historyCache) setHistory(historyCache);
    } finally {
      setLoading(false);
    }
  }, [user, statsCache, historyCache]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [signOut]);

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <AppText variant="body" color="textSecondary" style={{ textAlign: 'center', paddingHorizontal: 40 }}>
          Please sign in to view your profile
        </AppText>
      </View>
    );
  }

  // Memoize derived data to prevent unnecessary recalculations
  const name = useMemo(() => user.displayName || (user.email ? user.email.split('@')[0] : 'You'), [user.displayName, user.email]);
  const initial = useMemo(() => (name[0] || 'U').toUpperCase(), [name]);
  const minutes = useMemo(() => stats?.minutesListened || 0, [stats?.minutesListened]);
  const listenTime = useMemo(() => `${Math.floor(minutes / 60)}h ${minutes % 60}m`, [minutes]);
  const streak = useMemo(() => stats?.streak ?? userStats?.streak ?? 0, [stats?.streak, userStats?.streak]);

  // Memoized components to prevent unnecessary re-renders
  const StatCard = React.memo(({ value, label }) => (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <AppText variant="h2" color="accent">{value}</AppText>
      <AppText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>{label}</AppText>
    </View>
  ));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title row */}
        <View style={[styles.titleRow, { paddingTop: insets.top + 16 }]}>
          <AppText variant="displayM">Profile</AppText>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={10}
            style={[styles.gearBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Icon name="gear" size={20} color={theme.text} />
          </Pressable>
        </View>

        {/* Profile Card with inline editing capability */}
        {userStats ? (
          <ProfileInfoCard
            user={user}
            userStats={userStats}
            onEditPress={() => navigation.navigate('EditProfile')}
          />
        ) : (
          <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.identity}>
              <LinearGradient
                colors={[theme.gradientStart, theme.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <AppText variant="displayM" style={{ color: theme.onAccent }}>{initial}</AppText>
              </LinearGradient>
              <AppText variant="h2" style={{ marginTop: 14 }}>{name}</AppText>
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>{user.email}</AppText>
            </View>
            <Pressable
              onPress={() => navigation.navigate('EditProfile')}
              hitSlop={10}
              style={[styles.editProfileBtn, { backgroundColor: theme.accentSoft }]}
            >
              <Icon name="edit" size={18} color={theme.accent} />
            </Pressable>
          </View>
        )}

        {/* Streak card */}
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.streakCard}
        >
          <View style={styles.streakIcon}>
            <Icon name="flame" size={30} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="displayM" style={{ color: theme.onAccent }}>{streak}</AppText>
            <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
              day listening streak · keep it up!
            </AppText>
          </View>
        </LinearGradient>

        {/* Stats grid */}
        {loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.statsGrid}>
            <StatCard value={listenTime} label="Listen time" />
            <StatCard value={stats?.plays || 0} label="Stories played" />
            <StatCard value={stats?.favorites || 0} label="Favorites" />
            <StatCard value={stats?.finished || 0} label="Finished" />
          </View>
        )}

        {/* Recently played */}
        <View style={styles.section}>
          <AppText variant="micro" color="textTertiary" style={styles.sectionLabel}>
            RECENTLY PLAYED
          </AppText>
          {loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 12 }} />
          ) : history.length === 0 ? (
            <AppText variant="caption" color="textSecondary" style={{ paddingHorizontal: 20, marginTop: 8 }}>
              Nothing played yet.
            </AppText>
          ) : (
            history.slice(0, 5).map((item) => (
              <CompactRow
                key={item.storyId}
                story={item}
                onPress={() => navigation.navigate('StoryDetail', { storyId: item.storyId, story: { id: item.storyId, ...item } })}
              />
            ))
          )}
        </View>

        {/* Sign out */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Button title="Sign out" variant="ghost" leftIcon="lock" onPress={handleSignOut} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  identity: { alignItems: 'center', paddingVertical: 12 },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    padding: 17,
  },
  streakIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  section: { marginTop: 28 },
  sectionLabel: {
    paddingHorizontal: 20,
    marginBottom: 8,
    letterSpacing: 1,
  },
});

export default ProfileScreen;
