// Notification Service — handles FCM tokens
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { db, auth } from './firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'expo_push_token';
const NOTIFICATION_ENABLED_KEY = 'notifications_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  async requestPermission() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') return false;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      
      const token = tokenData.data;
      await AsyncStorage.setItem(TOKEN_KEY, token);
      
      if (auth.currentUser) {
        await this.saveToken(auth.currentUser.uid, token);
      }
      
      return true;
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  },

  async saveToken(userId, token) {
    try {
      await setDoc(doc(db, 'push_tokens', `${userId}_${token}`), {
        userId,
        token,
        platform: Platform.OS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Save token error:', error);
    }
  },

  async deleteToken(userId) {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await deleteDoc(doc(db, 'push_tokens', `${userId}_${token}`));
      } catch (error) {
        console.error('Delete token error:', error);
      }
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  },

  async isEnabled() {
    const enabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
    return enabled === 'true';
  },

  async setEnabled(enabled) {
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, String(enabled));
  },

  async getToken() {
    return AsyncStorage.getItem(TOKEN_KEY);
  },
};
