// Firebase Configuration for Story Byte
import { initializeApp, getApps, getApp } from 'firebase/app';
// NOTE: auth symbols are imported from the scoped `@firebase/auth` package
// (not the `firebase/auth` meta bundle) because only its react-native build
// exports `getReactNativePersistence`. The `firebase/*` meta packages are thin
// re-exports of the same scoped modules, so this shares one Firebase instance.
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  onAuthStateChanged
} from '@firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Expo inlines only EXPO_PUBLIC_-prefixed env vars into the client bundle.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Reuse the app across Fast Refresh reloads instead of re-initializing.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Persist auth with AsyncStorage. Without an explicit persistence the JS SDK
// keeps the session in memory only, so every reload / cold start logs the user
// out. initializeAuth must run once; on a second evaluation (Fast Refresh) or
// if persistence is unavailable it throws, so we fall back to the existing
// instance rather than crashing the module.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

// Export services
export { auth };
export const db = getFirestore(app);

export { signInWithEmailAndPassword, createUserWithEmailAndPassword, firebaseSignOut, sendPasswordResetEmail, confirmPasswordReset, onAuthStateChanged };
