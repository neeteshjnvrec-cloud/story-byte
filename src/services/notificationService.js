// Notification Service — reads from Firestore for real-time notifications
import { db, auth } from './firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  where,
  getDocs
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const TOKEN_KEY = 'expo_push_token';

export const notificationService = {
  // Request notification permissions and get token
  async requestPermission() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return false;
      return true;
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  },

  // Get stored push token
  async getToken() {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      return token;
    } catch (e) {
      console.error('Failed to get token:', e);
      return null;
    }
  },

  // Save push token to AsyncStorage and Firestore
  async saveToken(uid, token) {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      if (uid && token) {
        await updateDoc(doc(db, 'users', uid, 'push_tokens', 'main'), {
          token,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Failed to save token:', e);
    }
  },

  // Delete push token
  async deleteToken(uid) {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'push_tokens', 'main'));
      }
    } catch (e) {
      console.error('Failed to delete token:', e);
    }
  },

  // Subscribe to real-time notifications from Firestore
  subscribe(callback) {
    if (!auth.currentUser) return null;
    
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(items);
    }, (error) => {
      console.error('Notification subscription error:', error);
    });
    
    return unsubscribe;
  },

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
  },

  // Mark all notifications as read
  async markAllAsRead() {
    try {
      const q = query(collection(db, 'notifications'));
      const snapshot = await getDocs(q);
      console.log('[notificationService] markAllAsRead: found', snapshot.size, 'notifications');
      
      for (const docSnap of snapshot.docs) {
        console.log('[notificationService] Updating doc:', docSnap.id);
        await updateDoc(docSnap.ref, {
          read: true,
          readAt: new Date().toISOString(),
        });
      }
      console.log('[notificationService] markAllAsRead: completed');
    } catch (e) {
      console.error('[notificationService] Failed to mark all as read:', e);
    }
  },

  // Delete single notification
  async delete(notificationId) {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  },

  // Clear all notifications
  async clearAll() {
    try {
      const q = query(collection(db, 'notifications'));
      const snapshot = await getDocs(q);
      console.log('[notificationService] clearAll: found', snapshot.size, 'notifications');
      
      for (const docSnap of snapshot.docs) {
        console.log('[notificationService] Deleting doc:', docSnap.id);
        await deleteDoc(docSnap.ref);
      }
      console.log('[notificationService] clearAll: completed');
    } catch (e) {
      console.error('[notificationService] Failed to clear all:', e);
    }
  },

  // Get unread count
  async getUnreadCount() {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('read', '==', false)
      );
      const snapshot = await q.get();
      return snapshot.size;
    } catch (e) {
      return 0;
    }
  },
};
