// App Context for Story Byte
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, firebaseSignOut, onAuthStateChanged } from '../services/firebase';
import { setDoc, getDoc, doc, serverTimestamp, updateDoc, increment, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import apiService from '../services/api';
import { loginWithEmail as authServiceLogin, signupWithEmail as authServiceSignup, signOutUser, sendResetEmail } from '../services/auth';
import { dispatchAudioWorkflow } from '../utils/communityAudioGen';
import { storyPlays } from '../utils/storyMetrics';
import { notificationService } from '../services/notificationService';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_AUTOPLAY = 'storybyte-autoplay-next';
const STORAGE_LAST_TAB = 'storybyte-last-play-tab';
const STORAGE_WIFI_ONLY = 'storybyte-wifi-only';
const STORAGE_DOWNLOADS = 'storybyte-downloads';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

// Stories arrive with the doc id on `id` (community snapshots, feed reads) or on
// `storyId` (the field written into the doc itself). Accepts a bare id too.
const storyIdOf = (story) => (typeof story === 'string' ? story : story?.id || story?.storyId);

export const AppContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(null);
  const [favorites, setFavorites] = useState([]);

  // --- Shared social state ----------------------------------------------------
  // The single source of truth for like / save / rating / play metrics. Screens
  // used to each keep their own copy, so the same story showed different numbers
  // depending on where you looked and an action on one screen never reached the
  // others. Everything reads through getStoryMetrics below.
  const [likes, setLikes] = useState({});         // { storyId: true }
  const [myRatings, setMyRatings] = useState({}); // { storyId: 1..5 }
  const [storyMeta, setStoryMeta] = useState({}); // { storyId: { likesCount, plays, rating, ratingCount } }

  // Refs (must live inside the component — hooks can't run at module scope).
  // cacheRef avoids stale closures in loadUserData: state-based cache tracking
  // read stale values because loadUserData's dependency array captured them at
  // creation time rather than call time. publishInProgressRef is a mutex that
  // prevents concurrent publish calls from racing with fetchCommunityStories.
  // pendingRef holds story ids with an in-flight optimistic write, so an
  // onSnapshot delivery can't overwrite the new value with the pre-write one.
  const cacheRef = useRef({ profile: null, timestamp: 0 });
  const publishInProgressRef = useRef(false);
  const pendingRef = useRef({});

  // Cache profile data to avoid redundant fetches.
  // Uses cacheRef (not state) so loadUserData always reads current values.
  //
  // Likes and ratings load here rather than in the screens that show them:
  // CommunityScreen used to fetch its own copy, which meant Story Detail never
  // knew about them at all. Keying the load on auth in one place also kills the
  // race where a re-fetch clobbered a fresh optimistic like with stale data.
  const loadUserData = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return;

    const now = Date.now();
    const cached = cacheRef.current;
    const isStale = !cached.profile || now - cached.timestamp > 5 * 60 * 1000;

    // Social state is cheap (two small collection reads) and must never be
    // stale, so it loads on every call regardless of the profile cache.
    Promise.all([apiService.getUserLikes(), apiService.getUserRatings()])
      .then(([likedIds, ratings]) => {
        setLikes(Object.fromEntries(likedIds.map(id => [id, true])));
        setMyRatings(ratings || {});
      })
      .catch((error) => {
        console.error('Error loading likes/ratings:', error);
      });

    try {
      if (isStale) {
        const [profile, stats, favoritesData] = await Promise.all([
          apiService.getUserProfile(),
          apiService.getUserStats(),
          apiService.getFavorites()
        ]);
        setUserStats(profile);
        setFavorites(favoritesData);
        cacheRef.current = { profile, timestamp: now };
      } else {
        // Cache is fresh — still fetch favorites (it's not included in profile cache)
        const favoritesData = await apiService.getFavorites();
        setUserStats(cached.profile);
        setFavorites(favoritesData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback to cached data on error
      if (cached.profile) {
        setUserStats(cached.profile);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadUserData(firebaseUser);
        // Register for push here, once per sign-in. It used to live in a
        // button component that no screen renders, so it never ran — and even
        // when it did it saved a boolean instead of a token. Fire-and-forget:
        // a device without push (simulator, denied permission) must still get
        // in-app notifications.
        notificationService.registerForPush(firebaseUser.uid).catch(() => {});
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [loadUserData]);

  // --- Email/Password Auth ---------------------------------------------------

  const loginWithEmail = async (email, password) => {
    setLoading(true);
    try {
      await authServiceLogin(email, password);
      return auth.currentUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (email, password, displayName) => {
    setLoading(true);
    try {
      await authServiceSignup(email, password, displayName);
      return auth.currentUser;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    try {
      // Firebase sends a reset link to the email; the hosted page handles the rest.
      await sendResetEmail(email);
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  // --- Sign Out ---------------------------------------------------------------

  const signOut = async () => {
    try {
      setLoading(true);
      await firebaseSignOut(auth);
      setUser(null);
      setUserStats(null);
      setFavorites([]);
      // Per-user social state must go too, or the next account inherits the
      // previous user's hearts and stars. storyMeta is public aggregate data
      // and is left alone.
      setLikes({});
      setMyRatings({});
      pendingRef.current = {};
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // --- Social actions ---------------------------------------------------------
  // All four follow the same shape: flip local state immediately, mark the id
  // pending so an incoming snapshot won't undo it, write, then either clear the
  // flag or revert. The UI never waits on the network.

  // Merge freshly-read story docs into the metric store. Anyone holding server
  // data calls this — the community snapshot, fetchCommunityStories, Detail's
  // getStory — and every screen picks the values up.
  const receiveStoryDocs = useCallback((docs) => {
    const list = Array.isArray(docs) ? docs : [docs];
    setStoryMeta((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const d of list) {
        const id = storyIdOf(d);
        // An id with a write in flight keeps its optimistic value: the server
        // copy in this snapshot predates the write and would flicker backwards.
        if (!id || pendingRef.current[id]) continue;
        const incoming = {
          likesCount: d.likesCount ?? 0,
          plays: storyPlays(d),
          rating: d.rating ?? 0,
          ratingCount: d.ratingCount ?? 0,
          sharesCount: d.sharesCount ?? 0,
        };
        const current = next[id];
        if (current
          && current.likesCount === incoming.likesCount
          && current.plays === incoming.plays
          && current.rating === incoming.rating
          && current.ratingCount === incoming.ratingCount
          && current.sharesCount === incoming.sharesCount) continue;
        next[id] = incoming;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  // Patch one story's aggregates without touching the others.
  const patchMeta = useCallback((id, patch) => {
    setStoryMeta((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }, []);

  const toggleLike = useCallback(async (story) => {
    const id = storyIdOf(story);
    if (!id) return { success: false };
    if (!auth.currentUser) return { needsAuth: true };

    const wasLiked = !!likes[id];
    const baseCount = storyMeta[id]?.likesCount ?? story?.likesCount ?? 0;
    const nextCount = Math.max(0, wasLiked ? baseCount - 1 : baseCount + 1);

    pendingRef.current[id] = true;
    setLikes((prev) => ({ ...prev, [id]: !wasLiked }));
    patchMeta(id, { likesCount: nextCount });

    try {
      if (wasLiked) await apiService.unlikeStory(id);
      else await apiService.likeStory(id);
      return { success: true };
    } catch (error) {
      console.error('toggleLike error:', error);
      setLikes((prev) => ({ ...prev, [id]: wasLiked }));
      patchMeta(id, { likesCount: baseCount });
      throw error;
    } finally {
      delete pendingRef.current[id];
    }
  }, [likes, storyMeta, patchMeta]);

  // Only the personal score is predicted. The new average depends on the other
  // ratings, so it's taken from the transaction's return value rather than
  // guessed — a wrong guess would visibly correct itself a moment later.
  const rateStory = useCallback(async (story, value) => {
    const id = storyIdOf(story);
    if (!id) return { success: false };
    if (!auth.currentUser) return { needsAuth: true };

    const previous = myRatings[id] || 0;
    pendingRef.current[id] = true;
    setMyRatings((prev) => ({ ...prev, [id]: value }));

    try {
      const result = await apiService.rateStory(id, value);
      const isFirst = previous === 0;
      const baseCount = storyMeta[id]?.ratingCount ?? story?.ratingCount ?? 0;
      patchMeta(id, {
        rating: result?.average ?? value,
        ratingCount: isFirst ? baseCount + 1 : baseCount,
      });
      return { success: true, average: result?.average };
    } catch (error) {
      console.error('rateStory error:', error);
      setMyRatings((prev) => ({ ...prev, [id]: previous }));
      throw error;
    } finally {
      delete pendingRef.current[id];
    }
  }, [myRatings, storyMeta, patchMeta]);

  // Called by AudioContext when playback starts. Bumps the local count as well
  // as the doc so the number moves on screen without waiting for a refetch.
  //
  // Deliberately dependency-free: AudioContext holds this inside playStory's
  // useCallback, so a version that closed over storyMeta would re-create the
  // whole player callback every time anyone anywhere liked something.
  const recordPlay = useCallback((story) => {
    const id = storyIdOf(story);
    if (!id || !auth.currentUser) return;

    const fallback = typeof story === 'object' ? storyPlays(story) : 0;
    setStoryMeta((prev) => {
      const base = prev[id]?.plays ?? fallback;
      return { ...prev, [id]: { ...(prev[id] || {}), plays: base + 1 } };
    });

    updateDoc(doc(db, 'stories', id), { plays: increment(1), lastPlayedAt: serverTimestamp() })
      .catch(() => {
        // Best-effort: a failed play count must never interrupt playback.
        setStoryMeta((prev) => {
          const current = prev[id]?.plays;
          if (current == null) return prev;
          return { ...prev, [id]: { ...prev[id], plays: Math.max(0, current - 1) } };
        });
      });
  }, []);

  // Called by the share buttons once the OS share sheet reports a completed
  // share. Same optimistic-bump-then-revert shape as recordPlay, and likewise
  // dependency-free so passing it to a memoised list row doesn't re-create the
  // row every time an unrelated story's metrics change.
  //
  // Android caveat: Share.share always resolves to `sharedAction` there — the
  // platform doesn't report whether the user actually completed the share or
  // backed out of the chooser. So this over-counts slightly on Android. The
  // alternative is no share count at all, which is worse.
  const recordShare = useCallback((story) => {
    const id = storyIdOf(story);
    if (!id || !auth.currentUser) return;

    const fallback = typeof story === 'object' ? (story?.sharesCount ?? 0) : 0;
    setStoryMeta((prev) => {
      const base = prev[id]?.sharesCount ?? fallback;
      return { ...prev, [id]: { ...(prev[id] || {}), sharesCount: base + 1 } };
    });

    updateDoc(doc(db, 'stories', id), { sharesCount: increment(1), lastSharedAt: serverTimestamp() })
      .catch(() => {
        // Best-effort: the share itself already happened, so a failed counter
        // write must stay invisible.
        setStoryMeta((prev) => {
          const current = prev[id]?.sharesCount;
          if (current == null) return prev;
          return { ...prev, [id]: { ...prev[id], sharesCount: Math.max(0, current - 1) } };
        });
      });
  }, []);

  // --- Favorites --------------------------------------------------------------
  // Optimistic like toggleLike, and functional updates throughout: the previous
  // version read a captured `favorites` inside the setter, so two quick taps on
  // different stories could drop one of them.
  const toggleFavorite = useCallback(async (story) => {
    const id = storyIdOf(story);
    if (!id) return;
    const wasFavorite = favorites.some(f => f.id === id);

    setFavorites((prev) => (wasFavorite
      ? prev.filter(f => f.id !== id)
      : [...prev, { ...story, id }]));

    try {
      if (wasFavorite) await apiService.removeFavorite(id);
      else await apiService.addFavorite(id);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setFavorites((prev) => (wasFavorite
        ? [...prev, { ...story, id }]
        : prev.filter(f => f.id !== id)));
      throw error;
    }
  }, [favorites]);

  const isInFavorites = useCallback((storyId) => {
    return favorites.some(f => f.id === storyId);
  }, [favorites]);

  // The single read path for every metric on every screen.
  // Merge order: storyMeta (server + optimistic) wins over whatever doc the
  // screen is holding, so a story handed over as a nav param renders instantly
  // from its own fields and then corrects to the shared value.
  const getStoryMetrics = useCallback((story) => {
    const id = storyIdOf(story);
    const meta = storyMeta[id] || {};
    return {
      liked: !!likes[id],
      likesCount: meta.likesCount ?? story?.likesCount ?? 0,
      saved: favorites.some(f => f.id === id),
      plays: meta.plays ?? storyPlays(story),
      rating: meta.rating ?? story?.rating ?? 0,
      ratingCount: meta.ratingCount ?? story?.ratingCount ?? 0,
      sharesCount: meta.sharesCount ?? story?.sharesCount ?? 0,
      myRating: myRatings[id] || 0,
    };
  }, [storyMeta, likes, myRatings, favorites]);

  const updateUserProfile = useCallback(async (updates) => {
    try {
      await apiService.updateProfile(updates);
      // Refresh the profile doc so screens that read `userStats` show saved values immediately.
      if (user) {
        const profile = await apiService.getUserProfile();
        setUserStats(profile);
        // Invalidate cache ref to force fresh data on next load
        cacheRef.current = { profile: null, timestamp: 0 };
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }, [user]);

  // --- Community Story Generation ---------------------------------------------
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [communityStories, setCommunityStories] = useState([]);
  const [autoplayNext, setAutoplayNextState] = useState(true);
  const [wifiOnly, setWifiOnlyState] = useState(false);
  const [lastPlayTab, setLastPlayTabState] = useState(null); // 'home' | 'community'
  // Downloads: local file URI + metadata, keyed by story id.
  const [downloads, setDownloads] = useState({});
  const [downloadingIds, setDownloadingIds] = useState(new Set());

  // Restore autoplay + last-tab preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_AUTOPLAY);
        if (saved !== null) setAutoplayNextState(saved === 'true');
        const wifi = await AsyncStorage.getItem(STORAGE_WIFI_ONLY);
        if (wifi !== null) setWifiOnlyState(wifi === 'true');
        const tab = await AsyncStorage.getItem(STORAGE_LAST_TAB);
        if (tab) setLastPlayTabState(tab);
      } catch (e) {}
    })();
  }, []);

  // Rehydrate the downloads map from disk. Without this the Downloads tab was
  // empty after every relaunch even though the audio files were still there:
  // `downloads` only ever lived in memory. The manifest is the source of truth
  // and each entry is verified against the filesystem, so a file the OS removed
  // (or one deleted on another device) doesn't leave a dead row behind.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_DOWNLOADS);
        if (!raw) return;
        const saved = JSON.parse(raw);
        const verified = {};
        for (const [id, meta] of Object.entries(saved)) {
          if (!meta?.path) continue;
          const info = await FileSystem.getInfoAsync(meta.path).catch(() => null);
          if (info?.exists) verified[id] = meta;
        }
        setDownloads(verified);
        if (Object.keys(verified).length !== Object.keys(saved).length) {
          await AsyncStorage.setItem(STORAGE_DOWNLOADS, JSON.stringify(verified));
        }
      } catch (e) {}
    })();
  }, []);

  const setAutoplayNext = async (val) => {
    setAutoplayNextState(val);
    try { await AsyncStorage.setItem(STORAGE_AUTOPLAY, String(val)); } catch (e) {}
  };

  const setWifiOnly = async (val) => {
    setWifiOnlyState(val);
    try { await AsyncStorage.setItem(STORAGE_WIFI_ONLY, String(val)); } catch (e) {}
  };

  const setLastPlayTab = useCallback((tab) => {
    setLastPlayTabState(tab);
    try { AsyncStorage.setItem(STORAGE_LAST_TAB, tab).catch(() => {}); } catch (e) {}
  }, []);

  // Persist the downloads manifest alongside the state update so a relaunch can
  // rebuild the map. Takes the next map explicitly because setState is async.
  const persistDownloads = async (nextMap) => {
    try { await AsyncStorage.setItem(STORAGE_DOWNLOADS, JSON.stringify(nextMap)); } catch (e) {}
  };

  const toggleDownload = useCallback(async (story) => {
    if (!story?.audioUrl || !story?.id) return { downloaded: false };
    const id = story.id;
    const uid = auth.currentUser?.uid;
    const already = downloads[id];
    if (already) {
      const next = { ...downloads };
      delete next[id];
      setDownloads(next);
      await persistDownloads(next);
      // Delete the file too — leaving it behind meant "remove" freed no space
      // and the next download silently reused the stale audio.
      if (already.path) await FileSystem.deleteAsync(already.path, { idempotent: true }).catch(() => {});
      if (uid) {
        try {
          await setDoc(doc(db, 'users', uid, 'downloads', id), { downloaded: false }, { merge: true });
        } catch (e) { /* mirror is best-effort; local state is the truth */ }
      }
      return { downloaded: false, path: already.path };
    }

    // NOTE: `wifiOnly` is persisted and surfaced in Settings, but not enforced
    // here — detecting the connection type needs `expo-network`, which isn't in
    // package.json. Enforcing it with the module absent would crash on import,
    // so the gate is deliberately left out rather than faked.

    // documentDirectory, not cacheDirectory: the OS may purge the cache dir
    // under storage pressure, which would delete the audio the user downloaded
    // precisely so it would survive going offline.
    const dir = `${FileSystem.documentDirectory}downloads/`;
    setDownloadingIds((prev) => new Set(prev).add(id));
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const { uri } = await FileSystem.downloadAsync(story.audioUrl, `${dir}storybyte-${id}.mp3`);
      const meta = {
        story: {
          id: story.id, title: story.title, coverImage: story.coverImage,
          genre: story.genre, duration: story.duration, audioUrl: story.audioUrl,
        },
        path: uri,
        downloadedAt: new Date().toISOString(),
      };
      const next = { ...downloads, [id]: meta };
      setDownloads(next);
      await persistDownloads(next);
      if (uid) {
        try {
          await setDoc(doc(db, 'users', uid, 'downloads', id), { ...meta, downloaded: true }, { merge: true });
        } catch (e) { /* mirror is best-effort; local state is the truth */ }
      }
      return { downloaded: true, path: uri };
    } catch (e) {
      console.warn('[AppContext] download failed:', e.message);
      return { downloaded: false };
    } finally {
      setDownloadingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, [downloads]);

  const generateStory = async ({ title, prompt, genre, language }) => {
    setIsGenerating(true);
    try {
      const result = await apiService.generateCommunityStory({ title, prompt, genre, language });
      return result;
    } catch (error) {
      console.error('Error generating story:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const publishCommunityStory = async (storyData) => {
    // Mutex: prevent concurrent publish calls from racing with each other
    // and with fetchCommunityStories, which would corrupt communityStories state.
    if (publishInProgressRef.current) {
      console.warn('[AppContext] publishCommunityStory: previous publish still in progress, skipping');
      return null;
    }
    publishInProgressRef.current = true;

    // Per-user daily cap: max 10 community stories per author per day.
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const snap = await getDocs(query(
          collection(db, 'stories'),
          where('authorId', '==', uid),
          where('isCommunityStory', '==', true),
          where('createdAt', '>=', today),
        ));
        if (snap.size >= 10) {
          publishInProgressRef.current = false;
          return { limited: true, message: 'You can publish up to 10 stories per day.' };
        }
      }
    } catch (_) { /* best-effort; if count fails, allow through */ }

    try {
      const published = await apiService.publishCommunityStory(storyData);
      if (!published) return null;

      const storyId = published.storyId || published.id;

      // Deliberately NOT added to communityStories. The doc is created with
      // status 'under_review', which is invisible to everyone including its
      // author; the realtime listener picks it up only once the pipeline flips
      // it to 'published'. Prepending it here used to pin an unpublished draft
      // to the top of the feed for every user.
      const dispatched = await dispatchAudioWorkflow(storyId);
      if (!dispatched) {
        // Not fatal: the community-stories workflow also runs on a schedule and
        // sweeps up anything the dispatch missed. Worth logging loudly because
        // it means publication is delayed to the next sweep.
        console.error('[AppContext] workflow dispatch failed — story will be picked up by the scheduled run');
      }

      return published;
    } catch (error) {
      // The daily cap is actually enforced by the security rules (see
      // firestore/firestore.rules.json) — the pre-check above is only a
      // best-effort local count and can occasionally miss (e.g. two rapid
      // submissions racing each other). When the rules reject the write for
      // that reason, surface it the same friendly way instead of a raw
      // Firebase error.
      if (error?.code === 'permission-denied') {
        return { limited: true, message: 'You can publish up to 10 stories per day.' };
      }
      console.error('Error publishing story:', error);
      throw error;
    } finally {
      publishInProgressRef.current = false;
    }
  };

  // Stable identity: CommunityScreen keeps this in an effect dependency array,
  // and a fresh function each render tore down and re-created its Firestore
  // onSnapshot listener on every provider render.
  const fetchCommunityStories = useCallback(async () => {
    const stories = await apiService.getCommunityStories();
    setCommunityStories(stories);
    receiveStoryDocs(stories);
    return stories;
  }, [receiveStoryDocs]);

  // Realtime story docs arriving from CommunityScreen's listener. Kept here so
  // the list and the metric store update together — the screen used to hold
  // these in local state, which is why a like made on the feed was invisible
  // everywhere else.
  const receiveCommunityStories = useCallback((stories) => {
    setCommunityStories(stories);
    receiveStoryDocs(stories);
  }, [receiveStoryDocs]);

  const value = useMemo(() => ({
    user,
    loading,
    userStats,
    favorites,
    communityStories,
    isGenerating,
    loginWithEmail,
    signupWithEmail,
    resetPassword,
    signOut,
    toggleFavorite,
    isInFavorites,
    updateUserProfile,
    generateStory,
    publishCommunityStory,
    fetchCommunityStories,
    // Shared metrics
    receiveStoryDocs,
    receiveCommunityStories,
    getStoryMetrics,
    toggleLike,
    rateStory,
    recordPlay,
    recordShare,
    // Autoplay
    autoplayNext,
    setAutoplayNext,
    lastPlayTab,
    setLastPlayTab,
    // Downloads
    wifiOnly,
    setWifiOnly,
    downloads,
    downloadingIds,
    toggleDownload,
  }), [
    user, loading, userStats, favorites, communityStories, isGenerating,
    autoplayNext, lastPlayTab, wifiOnly,
    toggleFavorite, isInFavorites, updateUserProfile, fetchCommunityStories,
    receiveStoryDocs, receiveCommunityStories, getStoryMetrics, toggleLike,
    rateStory, recordPlay, recordShare, setAutoplayNext, setLastPlayTab, downloads, downloadingIds, toggleDownload,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Convenience read hook — the metrics for one story, recomputed whenever the
// shared social state changes.
export const useStoryMetrics = (story) => {
  const { getStoryMetrics } = useAppContext() || {};
  return getStoryMetrics
    ? getStoryMetrics(story)
    : { liked: false, likesCount: 0, saved: false, plays: 0, rating: 0, ratingCount: 0, sharesCount: 0, myRating: 0 };
};
