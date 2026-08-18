import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { notificationDb } from '../services/notificationDb';
import { Icon } from './ui/Icon';

export const NotificationBadge = () => {
  const navigation = useNavigation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const count = await notificationDb.getUnreadCount();
      setUnreadCount(count);
    } catch (e) {
      console.error('Failed to load unread count:', e);
    }
  };

  const handlePress = () => {
    navigation.navigate('Notifications');
  };

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <Icon name="bell" size={24} color="#B5613A" />
      {unreadCount > 0 && (
        <View style={[styles.badge, { top: -4, right: -4 }]}>
          <Icon name="x" size={10} color="#fff" />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
  }
});

export default NotificationBadge;
