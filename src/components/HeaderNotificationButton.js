import React, { useEffect, useState } from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { notificationService } from '../services/notificationService';
import { Icon } from './ui/Icon';

export const HeaderNotificationButton = ({ size = 24, color = '#B5613A' }) => {
  const navigation = useNavigation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Subscribe to notifications for real-time count updates
    const unsubscribe = notificationService.subscribe((items) => {
      const count = items.filter(n => !n.read).length;
      setUnreadCount(count);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handlePress = () => {
    navigation.navigate('Notifications');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.container}
      activeOpacity={0.7}
      accessibilityLabel="View notifications"
      accessibilityRole="button"
    >
      <Icon name="bell" size={size} color={color} />
      {unreadCount > 0 && (
        <View style={[styles.badge, { top: -4, right: -4 }]}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  }
});

export default HeaderNotificationButton;
