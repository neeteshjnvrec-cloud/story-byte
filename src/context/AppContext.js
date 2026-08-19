// App Context for Story Byte
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { auth, firebaseSignOut, onAuthStateChanged } from '../services/firebase';
import { setDoc, getDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import apiService from '../services/api';
import { loginWithEmail as authServiceLogin, signupWithEmail as authServiceSignup, signOutUser, sendResetEmail } from '../services/auth';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [profileCache, setProfileCache] = useState(null);
  const [lastProfileFetch, setLastProfileFetch] = useState(0);

  // Cache profile data to avoid redundant fetches
  const loadUserData = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return;
    
    try {
      const now = Date.now();
      // Only fetch if cache is stale (older than 5 minutes) or doesn't exist
      if (!profileCache || now - lastProfileFetch > 300000) {
        const [profile, stats, favoritesData] = await Promise.all([
          apiService.getUserProfile(),
          apiService.getUserStats(),
          apiService.getFavorites()
        ]);
        
        setUserStats(profile);
        setFavorites(favoritesData);
        setProfileCache(profile);
        setLastProfileFetch(now);
      } else {
        // Use cached data
        const favoritesData = await apiService.getFavorites();
        setUserStats(profileCache);
        setFavorites(favoritesData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback to cached data on error
      if (profileCache) {
        setUserStats(profileCache);
      }
    }
  }, [profileCache, lastProfileFetch]);

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
      // Refresh the profile doc (fullName, phone, gender, ...) so screens that
      // read `userStats` show the saved values immediately.
      if (user) {
        const profile = await apiService.getUserProfile();
        setUserStats(profile);
        // Invalidate cache to force fresh data on next load
        setProfileCache(null);
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

  // ── GitHub Actions dispatch & polling helpers ────────────────────────────────
  const GITHUB_OWNER = 'neeteshjnvrec-cloud';
  const GITHUB_REPO = 'story-byte';
  const GITHUB_WORKFLOW = 'daily-stories.yml';
  const MAX_POLL = 60;       // seconds to wait for audio generation
  const POLL_INTERVAL = 1000; // ms between polls

  /** Dispatch the daily-stories GitHub Actions workflow */
  async function dispatchWorkflow(storyId) {
    const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
    if (!token) {
      console.warn('[AppContext] EXPO_PUBLIC_GITHUB_TOKEN not set — skipping workflow dispatch');
      return false;
    }
    try {
      await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${encodeURIComponent(GITHUB_WORKFLOW)}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );
      console.log(`[AppContext] Workflow dispatched for community story ${storyId}`);
      return true;
    } catch (e) {
      console.error('[AppContext] Workflow dispatch failed:', e.message);
      return false;
    }
  }

  /** Poll Firestore until the story has a real hosting audioUrl */
  function waitForAudioGeneration(storyId) {
    return new Promise((resolve) => {
      let elapsed = 0;
      const interval = setInterval(async () => {
        elapsed += 1;
        try {
          const doc = await getDoc(doc(db, 'stories', storyId));
          if (doc.exists()) {
            const data = doc.data();
            if (data.audioUrl && data.audioUrl.startsWith('https://storybyte-76716.web.app')) {
              clearInterval(interval);
              resolve(data);
              return;
            }
          }
        } catch (_) {}
        if (elapsed >= MAX_POLL) {
          clearInterval(interval);
          resolve(null);
        }
      }, POLL_INTERVAL);
    });
  }

  const publishCommunityStory = async (storyData) => {
    try {
      const published = await apiService.publishCommunityStory(storyData);
      if (!published) return null;

      const storyId = published.storyId || published.id;

      // Remove any stale copy from previous list
      setCommunityStories(prev => {
        const filtered = prev.filter(s => (s.storyId || s.id) !== storyId);
        return [published, ...filtered];
      });

      // Trigger GitHub Actions to generate audio + deploy hosting
      const dispatched = await dispatchWorkflow(storyId);

      if (dispatched) {
        // Poll for up to ~1 min until audio URL appears
        const updated = await waitForAudioGeneration(storyId);
        if (updated) {
          setCommunityStories(prev => {
            const id = updated.storyId || updated.id || storyId;
            const filtered = prev.filter(s => (s.storyId || s.id) !== id);
            return [updated, ...filtered];
          });
        }
      }

      return published;
    } catch (error) {
      console.error('Error publishing story:', error);
      throw error;
    }
  };

  const fetchCommunityStories = async () => {
    try {
      const stories = await apiService.getCommunityStories();
      setCommunityStories(stories);
    } catch (error) {
      console.error('Error fetching community stories:', error);
    }
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
