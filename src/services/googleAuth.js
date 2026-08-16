/**
 * Google Authentication Service for StoryByte
 * Firebase Auth with Google Sign-In
 */

import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { auth } from './firebase';

const provider = new GoogleAuthProvider();

/**
 * Sign in with Google using Firebase Auth
 * @param {string} idToken - Google ID token from client
 * @returns {Promise<UserCredential>}
 */
export async function signInWithGoogle(idToken) {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    return userCredential;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Get current user
 * @returns {User|null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return auth.currentUser !== null;
}

export { provider, auth };
