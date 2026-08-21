// App Context for Story Byte
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { auth, firebaseSignOut, onAuthStateChanged } from '../services/firebase';
import { setDoc, getDoc, doc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import apiService from '../services/api';
import { loginWithEmail as authServiceLogin, signupWithEmail as authServiceSignup, signOutUser, sendResetEmail } from '../services/auth';
import { dispatchAudioWorkflow } from '../utils/communityAudioGen';
import { storyPlays } from '../utils/storyMetrics';
import { notificationService } from '../services/notificationService';

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
        };
        const current = next[id];
        if (current
          && current.likesCount === incoming.likesCount
          && current.plays === incoming.plays
          && current.rating === incoming.rating
          && current.ratingCount === incoming.ratingCount) continue;
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

  const generateStory = async ({ title, prompt, genre }) => {
    setIsGenerating(true);
    try {
      const result = await apiService.generateCommunityStory({ title, prompt, genre });
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
  }), [
    user, loading, userStats, favorites, communityStories, isGenerating,
    toggleFavorite, isInFavorites, updateUserProfile, fetchCommunityStories,
    receiveStoryDocs, receiveCommunityStories, getStoryMetrics, toggleLike,
    rateStory, recordPlay,
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
    : { liked: false, likesCount: 0, saved: false, plays: 0, rating: 0, ratingCount: 0, myRating: 0 };
};
