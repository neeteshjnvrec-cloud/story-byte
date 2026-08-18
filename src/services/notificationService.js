// Notification Service - Manages FCM tokens and permission requests
import { getMessaging, getToken, onMessage } from '@react-native-firebase/messaging';
import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'fcm_token';
const NOTIFICATION_ENABLED_KEY = 'notifications_enabled';

export const notificationService = {
  // Request permission and get FCM token
  async requestPermission() {
    try {
      const authStatus = await getToken({
        vapidKey: process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY,
      });
      
      // Check if user is logged in
      if (auth.currentUser) {
        await saveToken(auth.currentUser.uid, authStatus);
      }
      
      return authStatus;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return null;
    }
  },

  // Save FCM token to Firestore
  async saveToken(userId, token) {
    try {
      await setDoc(doc(db, 'users', userId, 'fcm_tokens', token), {
        token,
        createdAt: new Date().toISOString(),
        platform: 'android', // Can be extended for iOS
        lastUsed: new Date().toISOString()
      });
      
      // Also store locally
      await AsyncStorage.setItem(TOKEN_KEY, token);
      
      return true;
    } catch (error) {
      console.error('Error saving FCM token:', error);
      return false;
    }
  },

  // Delete old token when user logs out
  async deleteToken(userId) {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token && userId) {
        await setDoc(doc(db, 'users', userId, 'fcm_tokens', token), {
          deletedAt: new Date().toISOString()
        }, { merge: true });
      }
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error deleting token:', error);
    }
  },

  // Listen for foreground messages
  onMessage(callback) {
    return onMessage((payload) => {
      console.log('Message received:', payload);
      callback(payload);
    });
  },

  // Check if notifications are enabled
  async isEnabled() {
    const enabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
    return enabled === 'true';
  },

  // Set notification preference
  async setEnabled(enabled) {
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, String(enabled));
  },

  // Get stored token
  async getToken() {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
};
