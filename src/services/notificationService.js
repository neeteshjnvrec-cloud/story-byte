// Notification Service — per-user notifications in users/{uid}/notifications
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
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const TOKEN_KEY = 'expo_push_token';

// EAS project id — must match expo.extra.eas.projectId in app.json.
// getExpoPushTokenAsync() requires it explicitly in SDK 49+; without it the call
// throws and no token is ever obtained.
const EAS_PROJECT_ID = 'd60ac706-e177-401b-8307-eb0cd8e8dfff';

// Without a handler, a push that arrives while the app is in the foreground is
// delivered silently — the user sees nothing until they open the bell. Set at
// module scope so it's installed once, on first import.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  // Get current user ID
  get currentUserId() {
    return auth.currentUser?.uid || null;
  },

  // Request notification permissions. Returns whether they were granted —
  // it does NOT return a token; use registerForPush for that.
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

  /**
   * Ask for permission, fetch the Expo push token, and store it.
   *
   * This is the step that was missing entirely: the old caller treated
   * requestPermission()'s boolean as a token and saved `true` to Firestore, and
   * getToken() read an AsyncStorage key nothing ever wrote. No device has ever
   * had a usable push token, which is why broadcasts never reached anyone.
   *
   * Push only works on a physical device — the simulator has no push service,
   * so getExpoPushTokenAsync throws there and we bail quietly.
   *
   * @param {string} uid
   * @returns {Promise<string|null>} the token, or null if unavailable
   */
  async registerForPush(uid) {
    if (!uid) return null;

    const granted = await this.requestPermission();
    if (!granted) return null;

    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: EAS_PROJECT_ID,
      });
      if (!token) return null;
      await this.saveToken(uid, token);
      return token;
    } catch (e) {
      // Simulators, missing credentials, offline — none of these should be fatal.
      console.warn('[notificationService] Could not get push token:', e.message);
      return null;
    }
  },

  /**
   * Handle taps on delivered push notifications.
   *
   * Covers both cases: the app was already running (addNotificationResponse-
   * ReceivedListener) and the app was launched cold by the tap
   * (getLastNotificationResponseAsync, which the listener never fires for).
   *
   * @param {(data: object) => void} onOpen - receives the notification's `data`
   * @returns {() => void} unsubscribe
   */
  addResponseListener(onOpen) {
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const data = response?.notification?.request?.content?.data;
        if (data) onOpen(data);
      })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data) onOpen(data);
    });

    return () => sub.remove();
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

  // Save push token to AsyncStorage and Firestore.
  //
  // Two things the previous version got wrong: updateDoc fails when the target
  // doc doesn't exist (always, on first launch), and the token lived only in a
  // subcollection — so a broadcast fan-out would need one extra read per user to
  // find it. Mirroring it onto the user doc means the single `users` query the
  // pipeline already runs yields the tokens too.
  async saveToken(uid, token) {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      if (uid && token) {
        await Promise.all([
          setDoc(doc(db, 'users', uid, 'push_tokens', 'main'), {
            token,
            updatedAt: new Date().toISOString(),
          }, { merge: true }),
          // `userId` is required by the users/{userId} update rule.
          setDoc(doc(db, 'users', uid), {
            userId: uid,
            pushToken: token,
            pushTokenUpdatedAt: new Date().toISOString(),
          }, { merge: true }),
        ]);
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
        await Promise.all([
          deleteDoc(doc(db, 'users', uid, 'push_tokens', 'main')),
          setDoc(doc(db, 'users', uid), { userId: uid, pushToken: null }, { merge: true }),
        ]);
      }
    } catch (e) {
      console.error('Failed to delete token:', e);
    }
  },

  // Subscribe to REAL-TIME notifications for CURRENT USER only
  subscribe(callback) {
    const userId = this.currentUserId;
    if (!userId) {
      console.warn('[notificationService] No user logged in, cannot subscribe');
      return null;
    }

    // Query ONLY this user's notifications
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(items);
    }, (error) => {
      console.error('[notificationService] Subscription error:', error);
    });

    return unsubscribe;
  },

  // Mark notification as read (ONLY for current user)
  async markAsRead(notificationId) {
    const userId = this.currentUserId;
    if (!userId) throw new Error('User not authenticated');

    try {
      await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
        read: true,
        readAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to mark read:', e);
      throw e;
    }
  },

  // Mark all notifications as read (ONLY for current user)
  async markAllAsRead() {
    const userId = this.currentUserId;
    if (!userId) throw new Error('User not authenticated');

    try {
      const q = query(collection(db, 'users', userId, 'notifications'));
      const snapshot = await getDocs(q);
      console.log('[notificationService] markAllAsRead: found', snapshot.size, 'notifications');

      const batch = [];
      for (const docSnap of snapshot.docs) {
        batch.push(updateDoc(docSnap.ref, {
          read: true,
          readAt: new Date().toISOString(),
        }));
      }
      await Promise.all(batch);
      console.log('[notificationService] markAllAsRead: completed');
    } catch (e) {
      console.error('[notificationService] Failed to mark all as read:', e);
      throw e;
    }
  },

  // Delete single notification (ONLY for current user)
  async delete(notificationId) {
    const userId = this.currentUserId;
    if (!userId) throw new Error('User not authenticated');

    try {
      await deleteDoc(doc(db, 'users', userId, 'notifications', notificationId));
    } catch (e) {
      console.error('Failed to delete:', e);
      throw e;
    }
  },

  // Clear all notifications (ONLY for current user)
  async clearAll() {
    const userId = this.currentUserId;
    if (!userId) throw new Error('User not authenticated');

    try {
      const q = query(collection(db, 'users', userId, 'notifications'));
      const snapshot = await getDocs(q);
      console.log('[notificationService] clearAll: found', snapshot.size, 'notifications');

      const batch = [];
      for (const docSnap of snapshot.docs) {
        batch.push(deleteDoc(docSnap.ref));
      }
      await Promise.all(batch);
      console.log('[notificationService] clearAll: completed');
    } catch (e) {
      console.error('[notificationService] Failed to clear all:', e);
      throw e;
    }
  },

  // Get unread count (ONLY for current user)
  async getUnreadCount() {
    const userId = this.currentUserId;
    if (!userId) return 0;

    try {
      const q = query(
        collection(db, 'users', userId, 'notifications'),
        where('read', '==', false)
      );
      // getDocs(q), not q.get(): this is a v9 modular Query and has no .get().
      // The old call threw on every invocation and the catch quietly returned 0,
      // so the count was permanently zero.
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (e) {
      console.error('Failed to get unread count:', e);
      return 0;
    }
  },

  // Create notification for a SPECIFIC user (admin/internal use)
  async createForUser(userId, notificationData) {
    try {
      const notifRef = doc(collection(db, 'users', userId, 'notifications'));
      await setDoc(notifRef, {
        ...notificationData,
        userId, // Store which user this belongs to
        read: false,
        // serverTimestamp, matching what the generation pipeline writes. Mixing
        // Timestamps and ISO strings in one collection breaks the subscribe
        // query's orderBy, since Firestore sorts across types before values.
        createdAt: serverTimestamp(),
      });
      return { success: true, id: notifRef.id };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },
};
