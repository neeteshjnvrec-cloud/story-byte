import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { notificationService } from '../services/notificationService';

// Keys must match the `type` written by the generation pipeline
// (scripts/lib/notify.js). An unmapped type falls through to a generic bell,
// which is what story_published and new_community_story used to do.
const TYPE_ICONS = {
  new_story: 'book',
  story_published: 'check-circle',
  new_community_story: 'people',
  reminder: 'bell',
  update: 'info',
};

const TYPE_COLORS = {
  new_story: '#B5613A',
  story_published: '#3E9C6D',
  new_community_story: '#8B5CF6',
  reminder: '#E0913A',
  update: '#667eea',
};

export const NotificationsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme() || { theme: {} };
  const { user } = useAppContext();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Subscribe to real-time notifications from Firestore
    const unsubscribe = notificationService.subscribe((items) => {
      setNotifications(items);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force reload by re-subscribing
    // We'll just wait a moment and refresh state
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleNotificationPress = async (item) => {
    // Mark as read in Firestore
    try {
      await notificationService.markAsRead(item.id);
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
    
    // Update local state
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    
    // Navigate to story if available
    if (item.storyId) {
      navigation.navigate('StoryDetail', { storyId: item.storyId });
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Notifications',
      'Remove all notification history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: async () => {
          try {
            await notificationService.clearAll();
            setNotifications([]);
          } catch (e) {
            console.error('Failed to clear notifications:', e);
          }
        }}
      ]
    );
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationService.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error('Failed to delete notification:', e);
    }
  };

  const renderItem = ({ item }) => {
    const icon = TYPE_ICONS[item.type] || 'bell';
    const color = TYPE_COLORS[item.type] || '#B5613A';
    const timeAgo = getTimeAgo(item.createdAt);

    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        style={[
          styles.card,
          { backgroundColor: item.read ? theme.card : theme.accent + '15' },
        ]}
        android_ripple={{ color: theme.divider }}
      >
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Icon name={icon} size={20} color={color} />
        </View>
        <View style={styles.content}>
          <AppText variant="label" color="text" numberOfLines={1}>
            {item.title}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={2}>
            {item.body}
          </AppText>
          <AppText variant="caption" color="textTertiary" style={styles.time}>
            {timeAgo}
          </AppText>
        </View>
        {!item.read && <View style={styles.dot} />}
        <Pressable
          onPress={() => handleDelete(item.id)}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="trash" size={16} color={theme.textTertiary} />
        </Pressable>
      </Pressable>
    );
  };

  const getKey = (item) => item.id;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <AppText variant="h2" color="text">Notifications</AppText>
        <View style={styles.headerActions}>
          {notifications.length > 0 && (
            <>
              <Pressable onPress={handleMarkAllRead} hitSlop={8} style={styles.headerBtn}>
                <Icon name="check" size={18} color={theme.accent} />
              </Pressable>
              <Pressable onPress={handleClearAll} hitSlop={8} style={styles.headerBtn}>
                <Icon name="trash" size={18} color={theme.error} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bell-slash" size={48} color={theme.textTertiary} />
          <AppText variant="h3" color="text" style={styles.emptyTitle}>No notifications yet</AppText>
          <AppText variant="body" color="textSecondary" style={styles.emptyText}>
            New stories will appear here
          </AppText>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={getKey}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        />
      )}
    </View>
  );
};

// Accepts a Firestore Timestamp, an ISO string, or null. Null happens on the
// local snapshot of a serverTimestamp write before the server acknowledges it —
// `new Date(null)` is 1970, which rendered as an absurd date.
function getTimeAgo(value) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { marginTop: 16, textAlign: 'center' },
  emptyText: { marginTop: 8, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 2,
    borderRadius: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: { flex: 1, minWidth: 0 },
  time: { marginTop: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E53E3E',
    position: 'absolute',
    top: 12,
    right: 40,
  },
  deleteBtn: { padding: 8, marginLeft: 4 },
});

export default NotificationsScreen;
