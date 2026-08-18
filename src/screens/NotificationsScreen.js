import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { notificationDb } from '../services/notificationDb';

const TYPE_ICONS = {
  new_story: 'book',
  reminder: 'bell',
  update: 'info',
};

const TYPE_COLORS = {
  new_story: '#B5613A',
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

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await notificationDb.getAll();
      setNotifications(data);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPress = async (item) => {
    await notificationDb.markAsRead(item.id);
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    
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
          await notificationDb.clearAll();
          setNotifications([]);
        }}
      ]
    );
  };

  const handleMarkAllRead = async () => {
    await notificationDb.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderItem = ({ item }) => (
    <Pressable
      onPress={() => handleNotificationPress(item)}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: TYPE_COLORS[item.type] || '#B5613A' }]}>
        <Icon name={TYPE_ICONS[item.type] || 'bell'} size={20} color="#fff" />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="label" color="text" numberOfLines={1}>
            {item.title}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {formatDate(item.createdAt)}
          </AppText>
        </View>
        {item.body ? (
          <AppText variant="body" color="textSecondary" numberOfLines={2}>
            {item.body}
          </AppText>
        ) : null}
        {item.genre ? (
          <AppText variant="micro" color="accent" style={styles.genreTag}>
            {item.genre}
          </AppText>
        ) : null}
      </View>
      {!item.read && (
        <View style={[styles.unreadDot, { backgroundColor: theme.accent }]} />
      )}
    </Pressable>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Icon name="bell" size={48} color={theme.textTertiary} />
      <AppText variant="h3" color="text" style={styles.emptyTitle}>No notifications yet</AppText>
      <AppText variant="body" color="textSecondary" style={styles.emptyText}>
        We'll notify you when new stories are available
      </AppText>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerSide}>
          <Icon name="chev-left" size={26} color={theme.text} />
        </Pressable>
        <AppText variant="h3">Notifications</AppText>
        <View style={styles.headerActions}>
          {notifications.length > 0 && (
            <>
              <Pressable onPress={handleMarkAllRead} hitSlop={8} style={styles.headerBtn}>
                <AppText variant="caption" color="accent">Mark all read</AppText>
              </Pressable>
              <Pressable onPress={handleClearAll} hitSlop={8} style={[styles.headerBtn, { marginLeft: 12 }]}>
                <AppText variant="caption" color="error">Clear</AppText>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : { paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerSide: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerBtn: {
    paddingVertical: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    position: 'relative',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  genreTag: {
    marginTop: 6,
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyList: {
    flexGrow: 1,
  },
});

export default NotificationsScreen;
