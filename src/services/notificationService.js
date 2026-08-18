// Notification Service — reads from Firestore for real-time notifications
import { db, auth } from './firebase';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';

export const notificationService = {
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
    const q = query(collection(db, 'notifications'));
    const snapshot = await q.get();
    const batch = [];
    snapshot.forEach(documentSnapshot => {
      batch.push(updateDoc(documentSnapshot.ref, { read: true, readAt: new Date().toISOString() }));
    });
    await Promise.all(batch);
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
    const q = query(collection(db, 'notifications'));
    const snapshot = await q.get();
    const batch = [];
    snapshot.forEach(documentSnapshot => {
      batch.push(deleteDoc(documentSnapshot.ref));
    });
    await Promise.all(batch);
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
