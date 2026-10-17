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
  updateProfile,
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
  const name = (displayName || '').trim();

  // The name on the account itself too (comments and the author fallback
  // read user.displayName). updateProfile is the modular SDK's function —
  // a Firebase user object has no updateProfile method of its own. Never
  // fails the signup: the account already exists at this point.
  if (name) await updateProfile(firebaseUser, { displayName: name }).catch(() => {});

  // Create the Firestore user document (owner-only per security rules).
  // `userId` must mirror the doc id: the rules check
  // `request.resource.data.userId == userId` on create/update. fullName is
  // what the profile, community author names and the Edit Profile prompt use.
  await setDoc(doc(db, 'users', firebaseUser.uid), {
    userId: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: name,
    ...(name ? { fullName: name } : {}),
    createdAt: serverTimestamp(),
  }, { merge: true });

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
