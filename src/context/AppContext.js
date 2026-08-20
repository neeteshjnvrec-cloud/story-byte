// App Context for Story Byte
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { auth, firebaseSignOut, onAuthStateChanged } from '../services/firebase';
import { setDoc, getDoc, doc, serverTimestamp } from 'firebase/firestore';
import apiService from '../services/api';
import { loginWithEmail as authServiceLogin, signupWithEmail as authServiceSignup, signOutUser, sendResetEmail } from '../services/auth';
import { dispatchAudioWorkflow } from '../utils/communityAudioGen';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(null);
  const [favorites, setFavorites] = useState([]);

  // Refs (must live inside the component — hooks can't run at module scope).
  // cacheRef avoids stale closures in loadUserData: state-based cache tracking
  // read stale values because loadUserData's dependency array captured them at
  // creation time rather than call time. publishInProgressRef is a mutex that
  // prevents concurrent publish calls from racing with fetchCommunityStories.
  const cacheRef = useRef({ profile: null, timestamp: 0 });
  const publishInProgressRef = useRef(false);

  // Cache profile data to avoid redundant fetches.
  // Uses cacheRef (not state) so loadUserData always reads current values.
  const loadUserData = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return;

    const now = Date.now();
    const cached = cacheRef.current;
    const isStale = !cached.profile || now - cached.timestamp > 5 * 60 * 1000;

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
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // --- Favorites --------------------------------------------------------------

  const toggleFavorite = async (story) => {
    try {
      if (favorites.some(f => f.id === story.id)) {
        await apiService.removeFavorite(story.id);
        setFavorites(favorites.filter(f => f.id !== story.id));
      } else {
        await apiService.addFavorite(story.id);
        setFavorites([...favorites, story]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  };

  const isInFavorites = (storyId) => {
    return favorites.some(f => f.id === storyId);
  };

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

      // Add to community stories list with pending flag — will be updated
      // by the GitHub Actions workflow once audio + cover image are ready.
      const storyWithPending = { ...published, _pendingPublish: true };
      setCommunityStories(prev => {
        const filtered = prev.filter(s => (s.storyId || s.id) !== storyId);
        return [storyWithPending, ...filtered];
      });

      // Fire-and-forget: dispatch the community-stories workflow.
      // The workflow picks up under_review stories, generates audio+image,
      // then flips status to 'published' and sends notifications.
      dispatchAudioWorkflow(storyId).catch(err => {
        console.error('[AppContext] workflow dispatch failed:', err.message);
        // Clear the pending flag so UI doesn't show stale state
        setCommunityStories(prev => prev.map(s =>
          (s.storyId || s.id) === storyId ? { ...s, _pendingPublish: false } : s
        ));
      });

      return published;
    } catch (error) {
      console.error('Error publishing story:', error);
      throw error;
    } finally {
      publishInProgressRef.current = false;
    }
  };

  const fetchCommunityStories = async () => {
    const stories = await apiService.getCommunityStories();
    setCommunityStories(stories);
    return stories;
  };

  return (
    <AppContext.Provider
      value={{
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
