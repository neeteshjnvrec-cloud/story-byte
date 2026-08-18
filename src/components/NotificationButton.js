import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { notificationService } from '../services/notificationService';
import { useAppContext } from '../context/AppContext';
import { Icon } from './ui/Icon';

export const NotificationButton = () => {
  const { user } = useAppContext();

  useEffect(() => {
    // Register token when user logs in
    if (user) {
      notificationService.requestPermission().then(token => {
        if (token && user) {
          notificationService.saveToken(user.uid, token);
        }
      });
    }
  }, [user]);

  const handleToggle = async () => {
    if (!user) return;
    
    const isEnabled = await notificationService.isEnabled();
    const newStatus = !isEnabled;
    
    await notificationService.setEnabled(newStatus);
    
    if (newStatus) {
      const token = await notificationService.getToken();
      if (token) {
        await notificationService.saveToken(user.uid, token);
      }
    }
  };

  if (!user) return null;

  return (
    <Pressable 
      onPress={handleToggle}
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: 0.7 }
      ]}
    >
      <Icon name="bell" size={20} color="#B5613A" />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFF5EB',
    borderWidth: 1,
    borderColor: '#EADFCC',
  }
});

export default NotificationButton;
