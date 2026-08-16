// App Context for Story Byte
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { auth, firebaseSignOut, onAuthStateChanged } from '../services/firebase';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
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
      // Refresh the profile doc (fullName, phone, gender, …) so screens that
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

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        userStats,
        favorites,
        loginWithEmail,
        signupWithEmail,
        resetPassword,
        signOut,
        toggleFavorite,
        isInFavorites,
        updateUserProfile
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
