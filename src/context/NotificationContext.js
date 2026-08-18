// Notifications Provider - Handles permission and message listening
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { notificationService } from '../services/notificationService';
import { useAppContext } from '../context/AppContext';

const NotificationContext = createContext({});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [token, setToken] = useState(null);
  const { user } = useAppContext();

  useEffect(() => {
    requestPermission();
    listenForMessages();
    
    // Cleanup on logout
    return () => {
      // Listeners are cleaned up automatically
    };
  }, [user]);

  const requestPermission = async () => {
    // Only request on mobile platforms
    if (Platform.OS === 'web') {
      // Web uses different notification API
      return;
    }

    try {
      const granted = await notificationService.requestPermission();
      if (granted) {
        setHasPermission(true);
        
        // Save token when user is logged in
        if (user) {
          const storedToken = await notificationService.getToken();
          setToken(storedToken);
        }
      }
    } catch (error) {
      console.error('Notification permission error:', error);
    }
  };

  const listenForMessages = () => {
    // Handle foreground messages
    const unsubscribe = notificationService.onMessage((payload) => {
      showNotification(payload);
    });

    // Handle background/terminated state messages
    // These are handled by the native side and shown by the system
  };

  const showNotification = (payload) => {
    const { data } = payload;
    const title = data?.title || 'New Story Available';
    const body = data?.body || 'Check out today\'s story!';
    const storyId = data?.storyId;

    Alert.alert(
      title,
      body,
      [
        { text: 'Dismiss', style: 'cancel' },
        ...(storyId ? [{ 
          text: 'Listen Now', 
          onPress: () => console.log('Navigate to story:', storyId)
        }] : [])
      ]
    );
  };

  const logoutToken = async () => {
    if (user) {
      await notificationService.deleteToken(user.uid);
      setToken(null);
    }
  };

  const value = {
    hasPermission,
    token,
    logoutToken
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
