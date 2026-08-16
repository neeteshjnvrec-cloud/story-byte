// Data service for Story Byte — talks DIRECTLY to Firestore via the client SDK.
//
// Firebase Cloud Functions require the paid Blaze plan, so this app runs
// entirely on the free Spark plan by reading/writing Firestore from the client,
// protected by the security rules in firestore/firestore.rules.json.
//
// Method names and return shapes are kept identical to the old HTTP-based
// ApiService so no screen/context code needs to change.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';

// Consecutive-day listening streak from a set of 'YYYY-MM-DD' strings.
// Counts back from today (with a one-day grace if today has no listen yet).
function streakFromDays(days) {
  if (!days || days.size === 0) return 0;
  const key = (d) => d.toISOString().slice(0, 10);
  const d = new Date();
  if (!days.has(key(d))) d.setDate(d.getDate() - 1); // allow streak if last listen was yesterday
  let s = 0;
  while (days.has(key(d))) { s += 1; d.setDate(d.getDate() - 1); }
  return s;
}

class ApiService {
  get uid() {
    return auth.currentUser?.uid || null;
  }

  // --- Stories -------------------------------------------------------------

  // Returns { stories: [...] }. Filters genre/language in-memory to avoid
  // needing extra composite indexes.
  async getStories(params = {}) {
    const { genre, language, limit = 50 } = params;

    const q = query(
      collection(db, 'stories'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      fbLimit(Number(limit))
    );

    const snap = await getDocs(q);
    let stories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (genre && genre !== 'All') {
      stories = stories.filter((s) => s.genre === genre);
    }
    if (language && language !== 'All') {
      const lang = String(language).toLowerCase();
      stories = stories.filter((s) => (s.language || '').toLowerCase() === lang);
    }

    return { stories };
  }

  // Returns the story object directly (StoryDetailScreen sets it as-is).
  async getStory(storyId) {
    const ref = doc(db, 'stories', storyId);
    const d = await getDoc(ref);
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() };
  }

  // Returns { categories: [{ name, count, totalPlays }] } aggregated from
  // active stories.
  async getCategories() {
    const q = query(collection(db, 'stories'), where('status', '==', 'active'));
    const snap = await getDocs(q);

    const map = {};
    snap.forEach((d) => {
      const data = d.data();
      const name = data.genre || 'other';
      if (!map[name]) map[name] = { count: 0, totalPlays: 0 };
      map[name].count += 1;
      map[name].totalPlays += data.plays || 0;
    });

    const categories = Object.entries(map).map(([name, v]) => ({
      name,
      count: v.count,
      totalPlays: v.totalPlays
    }));

    return { categories };
  }

  // Best-effort play count increment. Requires an authenticated user per the
  // security rules; silently ignored otherwise so playback is never blocked.
  async playStory(storyId) {
    if (!this.uid) return { success: false, reason: 'unauthenticated' };
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        plays: increment(1),
        lastPlayedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.warn('playStory: could not record play', error?.message);
      return { success: false };
    }
  }

  async rateStory(storyId, rating, review = null) {
    if (!this.uid) throw new Error('Authentication required to rate');
    await updateDoc(doc(db, 'stories', storyId), {
      rating: Number(rating),
      lastRatedAt: serverTimestamp(),
      ...(review ? { lastReview: review } : {})
    });
    return { success: true };
  }

  // --- Favorites (users/{uid}/favorites/{storyId}) -------------------------

  // Returns an array of { storyId, id, ...meta }.
  // Returns favorited stories with full data. Self-healing: any favorite whose
  // story no longer exists is dropped and its orphan doc deleted, so the count
  // and Library list stay accurate even after stories are removed.
  async getFavorites() {
    if (!this.uid) return [];
    const snap = await getDocs(collection(db, 'users', this.uid, 'favorites'));
    const results = await Promise.all(snap.docs.map(async (d) => {
      const story = await this.getStory(d.id);
      if (!story) {
        try { await deleteDoc(doc(db, 'users', this.uid, 'favorites', d.id)); } catch (e) {}
        return null;
      }
      return { ...story, id: d.id, storyId: d.id, favoritedAt: d.data().addedAt };
    }));
    return results.filter(Boolean);
  }

  async addFavorite(storyId) {
    if (!this.uid) throw new Error('Authentication required');
    await setDoc(doc(db, 'users', this.uid, 'favorites', storyId), {
      addedAt: serverTimestamp()
    });
    return { success: true };
  }

  async removeFavorite(storyId) {
    if (!this.uid) throw new Error('Authentication required');
    await deleteDoc(doc(db, 'users', this.uid, 'favorites', storyId));
    return { success: true };
  }

  async isFavorite(storyId) {
    if (!this.uid) return false;
    const d = await getDoc(doc(db, 'users', this.uid, 'favorites', storyId));
    return d.exists();
  }

  // --- Progress (users/{uid}/progress/{storyId}) ----------------------------

  // Returns a map of { storyId: progressDoc } for all stories the user has
  // listened to, with the story title/cover joined in for the profile UI.
  async getUserProgress() {
    if (!this.uid) return [];
    const snap = await getDocs(collection(db, 'users', this.uid, 'progress'));
    const progressDocs = snap.docs.map((d) => ({ storyId: d.id, ...d.data() }));

    // Enrich with story title/cover (only load stories the user actually has progress on)
    const enriched = await Promise.all(
      progressDocs.map(async (p) => {
        try {
          const story = await this.getStory(p.storyId);
          return story ? { ...p, title: story.title, coverImage: story.coverImage, genre: story.genre } : null;
        } catch (e) {
          return p;
        }
      })
    );

    return enriched.filter(Boolean).sort((a, b) => {
      const ta = a.lastUpdated?.toMillis?.() || 0;
      const tb = b.lastUpdated?.toMillis?.() || 0;
      return tb - ta;
    });
  }

  // Fetches a single story's saved progress for the current user (0-1 ratio).
  async getStoryProgress(storyId) {
    if (!this.uid) return null;
    const d = await getDoc(doc(db, 'users', this.uid, 'progress', storyId));
    if (!d.exists()) return null;
    const data = d.data();
    return {
      progress: data.progress || 0,
      currentTime: data.currentTime || 0,
      pagesCompleted: data.pagesCompleted || 0,
      lastUpdated: data.lastUpdated
    };
  }

  // Saves the user's playback position for a story.
  async saveProgress(storyId, { progress, currentTime, duration, pagesCompleted, speed }) {
    if (!this.uid) return { success: false, reason: 'unauthenticated' };
    try {
      await setDoc(doc(db, 'users', this.uid, 'progress', storyId), {
        progress,
        currentTime,
        duration,
        pagesCompleted,
        speed,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      console.warn('saveProgress:', error?.message);
      return { success: false };
    }
  }

  // --- User (users/{uid}) --------------------------------------------------

  async getUserProfile() {
    const u = auth.currentUser;
    if (!u) return null;
    const d = await getDoc(doc(db, 'users', u.uid));
    const stored = d.exists() ? d.data() : {};
    return {
      userId: u.uid,
      email: u.email,
      displayName: u.displayName,
      photoURL: u.photoURL,
      ...stored
    };
  }

  // Computed live from the user's favorites + progress subcollections (the
  // static users/{uid}.stats field was never maintained).
  async getUserStats() {
    const empty = { plays: 0, favorites: 0, minutesListened: 0, finished: 0, streak: 0 };
    if (!this.uid) return empty;
    const [favorites, progSnap] = await Promise.all([
      this.getFavorites(),
      getDocs(collection(db, 'users', this.uid, 'progress')),
    ]);
    let minutes = 0, finished = 0;
    const days = new Set();
    progSnap.forEach((d) => {
      const p = d.data();
      minutes += (p.currentTime || 0) / 60;
      if ((p.progress || 0) >= 0.98) finished += 1;
      const t = p.lastUpdated && p.lastUpdated.toDate ? p.lastUpdated.toDate() : null;
      if (t) days.add(t.toISOString().slice(0, 10));
    });
    return {
      plays: progSnap.size,
      favorites: favorites.length,
      minutesListened: Math.round(minutes),
      finished,
      streak: streakFromDays(days),
    };
  }

  // user_activity is admin-only per the security rules, so history is not
  // client-readable; return empty rather than throwing.
  async getUserHistory() {
    return [];
  }
}

export default new ApiService();
