// Profile Screen for Story Byte
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import apiService from '../services/api';

export const ProfileScreen = () => {
  const { user, signOut, userStats, loading: contextLoading } = useAppContext();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userStatsData = await apiService.getUserStats();
      const userHistory = await apiService.getUserHistory();

      setStats(userStatsData);
      setHistory(userHistory);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.notLoggedIn}>
          <Text style={[styles.notLoggedInText, { color: theme.text }]}>
            Please sign in to view your profile
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* User Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>
            {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
          </Text>
        </View>
        <Text style={[styles.userName, { color: theme.text }]}>
          {user.displayName || 'User'}
        </Text>
        <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
          {user.email}
        </Text>
      </View>

      {/* Stats */}
      <View style={[styles.section, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Stats</Text>
        {loading ? (
          <Text style={{ color: theme.textSecondary }}>Loading...</Text>
        ) : stats ? (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.statValue, { color: theme.accent }]}>
                {Math.floor((stats.minutesListened || 0) / 60)}h {(stats.minutesListened || 0) % 60}m
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Listen Time</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.statValue, { color: theme.accent }]}>
                {stats.plays || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Plays</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.statValue, { color: theme.accent }]}>
                {stats.favorites || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Favorites</Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: theme.textSecondary }}>No stats available</Text>
        )}
      </View>

      {/* Recent History */}
      <View style={[styles.section, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent History</Text>
        {loading ? (
          <Text style={{ color: theme.textSecondary }}>Loading...</Text>
        ) : history.length === 0 ? (
          <Text style={{ color: theme.textSecondary }}>No listening history</Text>
        ) : (
          history.slice(0, 5).map((item, index) => (
            <View key={index} style={styles.historyItem}>
              <Text style={[styles.historyTitle, { color: theme.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.historyDate, { color: theme.textSecondary }]}>
                {new Date(item.lastPlayed).toLocaleDateString()} • {item.playCount} plays
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Settings */}
      <View style={[styles.section, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Settings</Text>
        <TouchableOpacity style={styles.settingItem}>
          <Text style={[styles.settingText, { color: theme.text }]}>Language</Text>
          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>English</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <Text style={[styles.settingText, { color: theme.text }]}>Notifications</Text>
          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>Enabled</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <Text style={[styles.settingText, { color: theme.text }]}>Dark Mode</Text>
          <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
            {isDark ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={[styles.signOutButton, { backgroundColor: theme.error }]} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    padding: 20,
    paddingTop: 40,
    alignItems: 'center'
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold'
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 15
  },
  userEmail: {
    fontSize: 14,
    marginTop: 4
  },
  notLoggedIn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  notLoggedInText: {
    fontSize: 16,
    textAlign: 'center'
  },
  section: {
    padding: 20,
    borderBottomWidth: 1
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4
  },
  historyItem: {
    marginBottom: 15
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  historyDate: {
    fontSize: 14
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12
  },
  settingText: {
    fontSize: 16
  },
  settingValue: {
    fontSize: 16
  },
  signOutButton: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});