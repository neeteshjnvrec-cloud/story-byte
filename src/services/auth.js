// Auth service — Firebase Auth (client-direct, no backend).
// The app runs on Firebase Spark (no Cloud Functions), so everything here uses
// the Firebase Auth SDK directly. Profile/stats are read from Firestore by
// src/services/api.js + AppContext — never via an HTTP backend.
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from './firebase';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export { auth, db };

export const loginWithEmail = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const signupWithEmail = async (email, password, displayName) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const firebaseUser = result.user;

  // Create the Firestore user document (owner-only per security rules).
  // `userId` must mirror the doc id: the rules check
  // `request.resource.data.userId == userId` on create/update.
  await setDoc(doc(db, 'users', firebaseUser.uid), {
    userId: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: displayName || '',
    createdAt: serverTimestamp(),
  });

  return firebaseUser;
};

export const signOutUser = async () => {
  await firebaseSignOut(auth);
};

// Send Firebase's built-in password-reset email. The link opens Firebase's
// hosted reset page where the user sets a new password — no backend, no codes.
export const sendResetEmail = async (email) => {
  await sendPasswordResetEmail(auth, email);
  return { success: true };
};
