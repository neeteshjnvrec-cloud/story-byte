// In-app notifications service — stores notifications in AsyncStorage and Firestore
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import { collection, addDoc, query, orderBy, limit, getDocs, updateDoc, doc } from 'firebase/firestore';

const NOTIFICATIONS_KEY = 'storybyte_notifications';
const MAX_LOCAL = 50;

export const notificationDb = {
  // Save notification locally and optionally to Firestore
  async add(notification) {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      title: notification.title || 'New Story',
      body: notification.body || '',
      type: notification.type || 'new_story',
      storyId: notification.storyId || null,
      genre: notification.genre || null,
      coverImage: notification.coverImage || null,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // Save to local storage
    try {
      const existing = await this.getAll();
      existing.unshift(entry);
      const trimmed = existing.slice(0, MAX_LOCAL);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save notification:', e);
    }

    return entry;
  },

  // Get all notifications
  async getAll() {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  // Mark as read
  async markAsRead(id) {
    const notifications = await this.getAll();
    const updated = notifications.map(n => 
      n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
    );
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  },

  // Mark all as read
  async markAllAsRead() {
    const notifications = await this.getAll();
    const updated = notifications.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }));
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  },

  // Delete notification
  async delete(id) {
    const notifications = await this.getAll();
    const updated = notifications.filter(n => n.id !== id);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  },

  // Clear all
  async clearAll() {
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([]));
  },

  // Get unread count
  async getUnreadCount() {
    const notifications = await this.getAll();
    return notifications.filter(n => !n.read).length;
  },
};
