import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { notificationDb } from '../services/notificationDb';
import { Icon } from './ui/Icon';

export const HeaderNotificationButton = () => {
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
        <View style={[styles.badge, styles.badgePosition]}>
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
    marginRight: 8,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePosition: {
    position: 'absolute',
    top: 0,
    right: 0,
  }
});

export default HeaderNotificationButton;
