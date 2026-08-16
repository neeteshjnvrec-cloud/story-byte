// Firestore Authentication - using Firebase Auth (free tier)
const firebase = require('firebase-admin');

const firebaseConfig = {
  credential: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\n')
  }
};

const auth = firebase.initializeApp(firebaseConfig).auth();

// User Authentication
const createUser = async (email, password, displayName) => {
  const userCredential = await auth.createUserWithEmailAndPassword(email, password);
  return userCredential.user;
};

const signInUser = async (email, password) => {
  const userCredential = await auth.signInWithEmailAndPassword(email, password);
  return userCredential.user;
};

const signOutUser = async (user) => {
  await auth.signOut(user);
};

const resetPassword = async (email, newPassword) => {
  const user = await auth.getUserByEmail(email);
  await auth.recreateUser({
    uid: user.uid,
    email: user.email,
    emailVerified: true,
    password: newPassword
  });
  return user;
};

// Token verification
const verifyIdToken = async (idToken) => {
  const decodedToken = await auth.verifyIdToken(idToken);
  return decodedToken;
};

// Firebase Auth Configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

module.exports = {
  createUser,
  signInUser,
  signOutUser,
  resetPassword,
  verifyIdToken
};