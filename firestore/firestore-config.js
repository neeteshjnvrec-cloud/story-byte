const firebase = require('firebase-admin');

// Firestore Configuration using Firebase Free Tier
const firebaseConfig = {
  credential: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\n')
  }
};

const db = firebase.initializeApp(firebaseConfig).firestore();

// Database references
const storiesCollection = db.collection('stories');
const usersCollection = db.collection('users');
const favoritesCollection = db.collection('favorites');

// Helper functions for CRUD operations
const createStory = async (storyData) => {
  const doc = await storiesCollection.add({
    ...storyData,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return doc.id;
};

const getStory = async (storyId) => {
  const doc = await storiesCollection.doc(storyId).get();
  return doc.exists ? doc.data() : null;
};

const updateStory = async (storyId, updates) => {
  await storiesCollection.doc(storyId).update(updates);
};

const deleteStory = async (storyId) => {
  await storiesCollection.doc(storyId).delete();
};

const getStoriesByCategory = async (category, options = {}) => {
  const snapshot = await storiesCollection
    .where('category', '==', category)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();
  return snapshot.docs.map(doc => doc.data());
};

const getStoriesByLanguage = async (language, options = {}) => {
  const snapshot = await storiesCollection
    .where('language', '==', language)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();
  return snapshot.docs.map(doc => doc.data());
};

const addFavorite = async (userId, storyId) => {
  const doc = await favoritesCollection.doc(userId).collection('favorites').add({
    storyId,
    addedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return doc.id;
};

const removeFavorite = async (userId, storyId) => {
  const favRef = favoritesCollection.doc(userId).collection('favorites').doc(storyId);
  await favRef.delete();
};

const isFavorite = async (userId, storyId) => {
  const snapshot = await favoritesCollection
    .doc(userId)
    .collection('favorites')
    .where('storyId', '==', storyId)
    .get();
  return snapshot.size > 0;
};

const getUserFavorites = async (userId) => {
  const snapshot = await favoritesCollection.doc(userId).collection('favorites').get();
  return snapshot.docs.map(doc => doc.data());
};

module.exports = {
  db,
  storiesCollection,
  usersCollection,
  favoritesCollection,
  createStory,
  getStory,
  updateStory,
  deleteStory,
  getStoriesByCategory,
  getStoriesByLanguage,
  addFavorite,
  removeFavorite,
  isFavorite,
  getUserFavorites
};