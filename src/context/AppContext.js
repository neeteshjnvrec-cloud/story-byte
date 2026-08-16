// App Context for Story Byte
import React, { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        try {
          const profile = await apiService.getUserProfile();
          const stats = await apiService.getUserStats();
          const favoritesData = await apiService.getFavorites();

          setUserStats(stats);
          setFavorites(favoritesData);
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      }
    });

    return unsubscribe;
  }, []);

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

  const updateUserProfile = async (updates) => {
    try {
      await apiService.updateProfile(updates);
      // Refresh user stats after update
      if (user) {
        const stats = await apiService.getUserStats();
        setUserStats(stats);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

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
