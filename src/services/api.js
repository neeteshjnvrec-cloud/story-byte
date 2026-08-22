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
  runTransaction,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import Groq from 'groq-sdk';

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
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  get uid() {
    return auth.currentUser?.uid || null;
  }

  // Helper method to get cached data or fetch fresh
  async getCached(key, fetchFn) {
    const now = Date.now();
    const cached = this.cache.get(key);
    const expiry = this.cacheExpiry.get(key);
    
    if (cached && expiry && now < expiry) {
      return cached;
    }
    
    const data = await fetchFn();
    this.cache.set(key, data);
    this.cacheExpiry.set(key, now + this.CACHE_TTL);
    return data;
  }

  // Clear cache for a specific key
  clearCache(key) {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }

  // Clear all cache
  clearAllCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  // --- Stories -------------------------------------------------------------

  // Returns { stories: [...] }. Filters genre/language/vertical/duration in-memory to avoid
  // needing extra composite indexes.
  //
  // `community` picks the library: false (default) = the curated daily feed that
  // Home shows, true = community submissions, 'all' = both (Search). Daily and
  // community stories are the same doc shape on one lifecycle — isCommunityStory
  // is the only thing that separates them.
  async getStories(params = {}) {
    const { genre, language, vertical, duration, limit = 50, community = false } = params;

    const constraints = [where('status', '==', 'published')];
    if (community !== 'all') {
      constraints.push(where('isCommunityStory', '==', community === true));
    }

    const q = query(
      collection(db, 'stories'),
      ...constraints,
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
    if (vertical && vertical !== 'All') {
      stories = stories.filter((s) => (s.verticalId || '').toLowerCase() === vertical.toLowerCase());
    }
    if (duration && duration !== 'all') {
      stories = stories.filter((s) => {
        const dur = s.duration || 0;
        if (duration === 'short') return dur > 0 && dur < 300;
        if (duration === 'medium') return dur >= 300 && dur < 900;
        if (duration === 'long') return dur >= 900;
        return true;
      });
    }

    return { stories };
  }

  // Returns the story object directly (StoryDetailScreen sets it as-is).
  //
  // Non-published stories read as missing. `under_review` means the narration and
  // cover art don't exist yet, so the detail screen would render a story with no
  // audio; treating it as absent is what "invisible until published" means for a
  // direct lookup, including for its own author.
  async getStory(storyId) {
    const ref = doc(db, 'stories', storyId);
    const d = await getDoc(ref);
    if (!d.exists()) return null;
    const data = d.data();
    if (data.status && data.status !== 'published') return null;
    return { id: d.id, ...data };
  }

  // Returns { categories: [{ name, count, totalPlays }] } aggregated from the
  // published daily library. Equality-only, so no composite index is needed.
  async getCategories() {
    const q = query(
      collection(db, 'stories'),
      where('status', '==', 'published'),
      where('isCommunityStory', '==', false)
    );
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

  // --- Ratings (stories/{id}.ratingSum+ratingCount + users/{uid}/ratings/{id})
  //
  // The per-user doc is the source of truth, mirroring the likes pattern. The
  // story doc carries ratingSum + ratingCount so `rating` can be a genuine
  // average, and re-rating adjusts by the delta instead of double-counting.
  //
  // Legacy data: before this, `rating` was last-writer-wins and ratingCount was
  // incremented on every submit, so old aggregates are unrecoverable — there's
  // no record of who rated what. A story with no `ratingSum` is therefore
  // treated as having zero prior ratings and its count is reset.
  async rateStory(storyId, rating, review = null) {
    if (!this.uid) throw new Error('Authentication required to rate');

    const value = Number(rating);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error('Rating must be a whole number from 1 to 5');
    }

    const storyRef = doc(db, 'stories', storyId);
    const mineRef = doc(db, 'users', this.uid, 'ratings', storyId);

    try {
      const average = await runTransaction(db, async (tx) => {
        // All reads must precede all writes inside a transaction.
        const [storySnap, mineSnap] = await Promise.all([tx.get(storyRef), tx.get(mineRef)]);
        if (!storySnap.exists()) throw new Error('Story not found');

        const data = storySnap.data();
        const migrated = typeof data.ratingSum === 'number';
        let sum = migrated ? data.ratingSum : 0;
        let count = migrated ? (data.ratingCount || 0) : 0;

        const previous = mineSnap.exists() ? Number(mineSnap.data().rating) : null;
        if (previous != null && migrated) {
          sum += value - previous; // re-rate: swap the old score for the new one
        } else {
          sum += value;
          count += 1;
        }

        const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

        tx.set(mineRef, {
          rating: value,
          ratedAt: serverTimestamp(),
          ...(review ? { review } : {}),
        }, { merge: true });

        tx.update(storyRef, {
          ratingSum: sum,
          ratingCount: count,
          rating: avg, // still populated for existing readers — now a real average
          lastRatedAt: serverTimestamp(),
          ...(review ? { lastReview: review } : {}),
        });

        return avg;
      });

      return { success: true, average };
    } catch (error) {
      console.error('rateStory error:', error);
      throw error;
    }
  }

  // This user's score for one story, or 0 if they haven't rated it.
  async getUserRating(storyId) {
    if (!this.uid) return 0;
    try {
      const snap = await getDoc(doc(db, 'users', this.uid, 'ratings', storyId));
      return snap.exists() ? Number(snap.data().rating) || 0 : 0;
    } catch (error) {
      console.error('getUserRating error:', error);
      return 0;
    }
  }

  // All of this user's scores as { [storyId]: rating } — one read for a feed.
  async getUserRatings() {
    if (!this.uid) return {};
    try {
      const snap = await getDocs(collection(db, 'users', this.uid, 'ratings'));
      return Object.fromEntries(snap.docs.map(d => [d.id, Number(d.data().rating) || 0]));
    } catch (error) {
      console.error('getUserRatings error:', error);
      return {};
    }
  }

  // --- Likes (stories/{storyId}.likesCount + users/{uid}/likes/{storyId}) --
  // --- Likes (stories/{id}.likesCount + users/{uid}/likes/{id}) -------------
  //
  // Transactional, and idempotent on the per-user doc: the count and the like
  // record move together. Previously these were two sequential awaits, so a
  // failure on the second left likesCount permanently overcounted with no
  // record of who it belonged to.

  async likeStory(storyId) {
    if (!this.uid) throw new Error('Authentication required');
    const storyRef = doc(db, 'stories', storyId);
    const mineRef = doc(db, 'users', this.uid, 'likes', storyId);
    try {
      await runTransaction(db, async (tx) => {
        const mineSnap = await tx.get(mineRef);
        // Already liked — don't bump the count a second time.
        if (mineSnap.exists()) return;
        tx.set(mineRef, { likedAt: serverTimestamp() }, { merge: true });
        tx.update(storyRef, { likesCount: increment(1), lastLikedAt: serverTimestamp() });
      });
      return { success: true };
    } catch (error) {
      console.error('likeStory error:', error);
      throw error;
    }
  }

  async unlikeStory(storyId) {
    if (!this.uid) throw new Error('Authentication required');
    const storyRef = doc(db, 'stories', storyId);
    const mineRef = doc(db, 'users', this.uid, 'likes', storyId);
    try {
      await runTransaction(db, async (tx) => {
        const mineSnap = await tx.get(mineRef);
        // Not liked — nothing to decrement, and doing so would go negative.
        if (!mineSnap.exists()) return;
        tx.delete(mineRef);
        tx.update(storyRef, { likesCount: increment(-1) });
      });
      return { success: true };
    } catch (error) {
      console.error('unlikeStory error:', error);
      throw error;
    }
  }

  async isStoryLiked(storyId) {
    if (!this.uid) return false;
    try {
      const docSnap = await getDoc(doc(db, 'users', this.uid, 'likes', storyId));
      return docSnap.exists();
    } catch (error) {
      console.error('isStoryLiked error:', error);
      return false;
    }
  }

  async getUserLikes() {
    if (!this.uid) return [];
    try {
      const snap = await getDocs(collection(db, 'users', this.uid, 'likes'));
      return snap.docs.map(d => d.id);
    } catch (error) {
      console.error('getUserLikes error:', error);
      return [];
    }
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
      // Read the doc directly rather than through getStory, which also returns
      // null for a story that exists but isn't published. Only a genuinely
      // missing story should have its favorite deleted — otherwise a story
      // temporarily flipped back to under_review/failed would silently destroy
      // every user's bookmark of it.
      const storySnap = await getDoc(doc(db, 'stories', d.id));
      if (!storySnap.exists()) {
        try { await deleteDoc(doc(db, 'users', this.uid, 'favorites', d.id)); } catch (e) {}
        return null;
      }
      const story = storySnap.data();
      if (story.status && story.status !== 'published') return null; // hidden, but keep the bookmark
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

    // Enrich with full story data (title, coverImage, genre, duration, plays,
    // audioUrl, description, etc.) so RailCard renders correctly and playStory
    // has everything it needs.
    const enriched = await Promise.all(
      progressDocs.map(async (p) => {
        try {
          const story = await this.getStory(p.storyId);
          if (!story) return null;
          // Ensure progress is a proper number (0-1). Firestore can sometimes
          // return unexpected types for numeric fields, so normalize here.
          const rawProgress = p.progress;
          const progress = typeof rawProgress === 'number' && isFinite(rawProgress)
            ? Math.min(1, Math.max(0, rawProgress))
            : 0;
          return {
            ...p,
            ...story,
            // Keep progress-level fields (they take precedence for UI state)
            progress,
            currentTime: typeof p.currentTime === 'number' ? p.currentTime : 0,
            duration: typeof p.duration === 'number' ? p.duration : story.duration || 0,
            lastUpdated: p.lastUpdated,
          };
        } catch (e) {
          // If story fetch fails, still show the progress entry without story details
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
    
    const cacheKey = `userProfile_${u.uid}`;
    return this.getCached(cacheKey, async () => {
      const d = await getDoc(doc(db, 'users', u.uid));
      const stored = d.exists() ? d.data() : {};
      return {
        userId: u.uid,
        email: u.email,
        displayName: u.displayName,
        photoURL: u.photoURL,
        ...stored
      };
    });
  }

  async updateProfile(updates) {
    if (!this.uid) throw new Error('Authentication required');
    // Use setDoc with merge: true so it creates the document if it doesn't exist
    // (new users won't have a Firestore doc yet).
    await setDoc(doc(db, 'users', this.uid), {
      ...updates,
      userId: this.uid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    // Clear profile cache after update
    this.clearCache(`userProfile_${this.uid}`);
    return { success: true };
  }

  // Computed live from the user's favorites + progress subcollections (the
  // static users/{uid}.stats field was never maintained).
  async getUserStats() {
    const empty = { plays: 0, favorites: 0, minutesListened: 0, finished: 0, streak: 0 };
    if (!this.uid) return empty;
    
    const cacheKey = `userStats_${this.uid}`;
    return this.getCached(cacheKey, async () => {
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
    });
  }

  // user_activity is admin-only per the security rules, so history is not
  // client-readable; return empty rather than throwing.
  async getUserHistory() {
    return [];
  }

  // --- Account Deletion (archive + delete) -----------------------------------

  // Archive all user data to 'deleted_users' collection, then delete from
  // Firestore. The Firebase Auth account deletion must be done separately.
  async archiveAndDeleteUser() {
    if (!this.uid) throw new Error('Authentication required');

    const userId = this.uid;

    // 1. Fetch all user data to archive
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : {};

    // Fetch favorites
    const favSnap = await getDocs(collection(db, 'users', userId, 'favorites'));
    const favorites = [];
    favSnap.forEach((d) => favorites.push(d.data()));

    // Fetch progress
    const progSnap = await getDocs(collection(db, 'users', userId, 'progress'));
    const progress = [];
    progSnap.forEach((d) => progress.push(d.data()));

    // 2. Write to deleted_users collection with timestamp
    const archiveData = {
      ...userData,
      userId,
      favorites,
      progress,
      deletedAt: serverTimestamp(),
      reason: 'user_requested',
    };
    await setDoc(doc(db, 'deleted_users', userId), archiveData);

    // 3. Delete subcollections (favorites + progress)
    const favDeletes = favSnap.docs.map((d) => deleteDoc(d.ref));
    const progDeletes = progSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all([...favDeletes, ...progDeletes]);

    // 4. Delete user document
    await deleteDoc(doc(db, 'users', userId));

    return { success: true };
  }
  // --- Community Stories -----------------------------------------------------

  /**
   * Fetch Groq API keys and models from Firestore config collection.
   * Returns { keys: string[], models: string[] }
   */
  async fetchGroqConfig() {
    try {
      const configDoc = await getDoc(doc(db, 'config', 'groq_settings'));
      if (!configDoc.exists()) {
        // Default fallback if no config exists
        console.warn('Groq config not found in Firestore, using defaults');
        return {
          keys: [process.env.GROQ_API_KEY || ''],
          models: ['groq/compound', 'groq/deepseek-r1-distill-llama-70b']
        };
      }
      const data = configDoc.data();
      return {
        keys: Array.isArray(data.apiKeys) ? data.apiKeys.filter(Boolean) : [],
        models: Array.isArray(data.models) ? data.models.filter(Boolean) : []
      };
    } catch (error) {
      console.error('Error fetching Groq config:', error);
      return { keys: [], models: [] };
    }
  }

  /**
   * Generate story using Groq API with automatic key/model rotation on failure
   */
  async generateCommunityStory({ title, prompt, genre, language }) {
    const { keys, models } = await this.fetchGroqConfig();

    if (!keys.length || !models.length) {
      throw new Error('No Groq API keys or models configured in Firestore');
    }

    const langNames = { en: 'English', hi: 'Hindi (Devanagari)', bn: 'Bengali (Bengali script)', mr: 'Marathi (Devanagari)', te: 'Telugu (Telugu script)', ta: 'Tamil (Tamil script)', gu: 'Gujarati (Gujarati script)', ur: 'Urdu (Persian-Arabic)', kn: 'Kannada (Kannada script)', or: 'Odia (Odia script)', ml: 'Malayalam (Malayalam script)', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese' };
    const langInstruction = langNames[language] || 'English';
    const sysPrompt = `You are a storyteller for an audio app. Write a ${genre} story. The FULL response — title, description and text — must be written IN ${langInstruction}. Do not mix in English. 
JSON only: {"title":"max 60 chars","description":"one sentence","text":"450-800 words, spoken style, no markdown","tags":["${genre}"]}.`;

    const errors = [];

    // Try each key-model combination with retry
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const apiKey = keys[keyIndex];
      if (!apiKey) continue;

      const groq = new Groq({ apiKey });

      for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
        const model = models[modelIndex];
        
        try {
          const completion = await groq.chat.completions.create({
            model,
            temperature: 0.85,
            max_tokens: 2048,
            top_p: 0.95,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: `Write a ${genre} story in ${langInstruction} based on this prompt: ${prompt}` }
            ],
          });

          const content = completion.choices[0]?.message?.content;
          if (!content) throw new Error('Empty response from Groq');

          const parsed = JSON.parse(content.trim());
          
          if (!parsed.title || !parsed.text || parsed.text.trim().length < 50) {
            throw new Error('Incomplete story generated');
          }

          console.log(`✅ Generated story using model: ${model} (key ${keyIndex + 1}/${keys.length})`);
          
          return {
            title: parsed.title.replace(/^["']|["']$/g, '').slice(0, 70),
            description: parsed.description || `A ${genre} story`,
            prompt,
            genre,
            text: parsed.text.trim(),
            tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [genre],
            status: 'draft',
            authorId: this.uid,
            authorName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Anonymous',
            modelUsed: model,
            keyUsed: keyIndex,
          };

        } catch (error) {
          const errorMsg = error.message || 'Unknown error';
          errors.push({ model, keyIndex, error: errorMsg });
          console.log(`✗ Failed (${model}, key ${keyIndex + 1}): ${errorMsg.slice(0, 50)}`);

          // Don't retry on authentication/key errors - skip to next key
          if (errorMsg.includes('authentication') || errorMsg.includes('Invalid API Key') || errorMsg.includes('401')) {
            break;
          }
        }
      }
    }

    // All combinations failed
    const errorSummary = errors.map(e => `${e.model}(key${e.keyIndex + 1}):${e.error.slice(0, 30)}`).join(' | ');
    throw new Error(`All Groq combinations failed: ${errorSummary}`);
  }

  async publishCommunityStory(storyData) {
    try {
      const storyId = `community_${Date.now()}_${this.uid}`;
      const storyRef = doc(db, 'stories', storyId);

      // Generate a cover image URL locally (Pollinations AI — free, no key needed)
      let coverImage = '';
      try {
        const prompt = encodeURIComponent(
          `${storyData.genre} story illustration, children's book style, warm colors, ${storyData.title || ''}`
        );
        const seed = Math.floor(Math.random() * 99999);
        coverImage = `https://image.pollinations.ai/prompt/${prompt}?width=768&height=768&nologo=true&seed=${seed}&model=flux`;
      } catch (_) {}

      const storyDoc = {
        storyId,
        title: storyData.title,
        description: storyData.description || storyData.prompt,
        genre: storyData.genre,
        language: storyData.language || 'en',
        text: storyData.text,
        audioUrl: '',          // filled by host-on-firebase.js after deploy
        coverImage,            // real AI-generated URL saved immediately
        duration: 0,
        authorName: storyData.authorName || 'Anonymous',
        authorId: this.uid,
        authorProfilePic: storyData.authorProfilePic || '',
        isCommunityStory: true,
        status: 'under_review',
        // Every aggregate present from birth, under the names the increments
        // and the readers actually use. This previously wrote `playsCount`,
        // which nothing ever incremented, so community stories were invisible
        // to Home's trending filter and showed a permanent zero.
        likesCount: 0,
        plays: 0,
        rating: 0,
        ratingSum: 0,
        ratingCount: 0,
        sharesCount: 0,
        tags: storyData.tags || [storyData.genre],
        modelUsed: storyData.modelUsed || '',
        ttsEngine: 'edge-tts', // host-on-firebase.js picks this up to generate audio
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(storyRef, storyDoc);

      return { ...storyDoc, id: storyId };
    } catch (error) {
      console.error('Error publishing community story:', error);
      throw error;
    }
  }

  async getCommunityStories() {
    try {
      // Wait for index to be ready (index building can take 1-2 minutes)
      const MAX_RETRIES = 3;
      const DELAY_MS = 2000;
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const q = query(
            collection(db, 'stories'),
            where('isCommunityStory', '==', true),
            // under_review stories are invisible to everyone, including their
            // own author — the pipeline flips them to 'published' once audio,
            // cover and doc are all wired.
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc'),
            fbLimit(50)
          );
          
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
          if (error.code === 'failed-precondition' && attempt < MAX_RETRIES - 1) {
            // Index is building, wait and retry
            console.log(`⏳ Index building, retrying in ${DELAY_MS/1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Error fetching community stories:', error);
      return [];
    }
  }

  async createNotification(notificationData) {
    try {
      // Create notification for a specific user
      const userId = notificationData.userId || this.uid;
      if (!userId) {
        console.warn('createNotification: no userId provided');
        return null;
      }

      const notifRef = doc(collection(db, 'users', userId, 'notifications'));
      await setDoc(notifRef, {
        ...notificationData,
        userId,
        read: false,
        createdAt: serverTimestamp(),
      });
      return { id: notifRef.id, success: true };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // --- Comments ----------------------------------------------------------------

  async getComments(storyId) {
    try {
      const snap = await getDocs(collection(db, 'stories', storyId, 'comments'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() ?? new Date(0);
        const bTime = b.createdAt?.toDate?.() ?? new Date(0);
        return aTime - bTime;
      });
    } catch (e) {
      console.warn('getComments failed:', e.message);
      return [];
    }
  }

  async addComment(storyId, { authorId, authorName, authorPic, text }) {
    try {
      const ref = await addDoc(collection(db, 'stories', storyId, 'comments'), {
        authorId,
        authorName: authorName || 'Anonymous',
        authorPic: authorPic || '',
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      // Bump the count on the story so the feed shows it without a full re-fetch.
      await updateDoc(doc(db, 'stories', storyId), {
        commentsCount: increment(1),
      }).catch(() => {});
      return ref.id;
    } catch (e) {
      console.error('addComment failed:', e.message);
      throw e;
    }
  }

  async deleteComment(storyId, commentId, authorId) {
    try {
      await deleteDoc(doc(db, 'stories', storyId, 'comments', commentId));
      await updateDoc(doc(db, 'stories', storyId), {
        commentsCount: increment(-1),
      }).catch(() => {});
    } catch (e) {
      console.error('deleteComment failed:', e.message);
      throw e;
    }
  }
}

export default new ApiService();
