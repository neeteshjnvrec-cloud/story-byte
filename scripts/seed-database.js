/**
 * Seed script - Populate Firebase Firestore with initial data
 *
 * Usage: node scripts/seed-database.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.resolve(__dirname, '../firebase-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Initial story templates (for offline/degraded mode)
const initialStories = [
  {
    title: 'Love in the Library',
    description: 'A chance meeting between two book lovers changes everything.',
    genre: 'romance',
    language: 'en',
    episode: 1,
    audioUrl: 'https://storage.googleapis.com/storybyte-audio/love-in-the-library.mp3',
    duration: 420,
    rating: 4.5,
    plays: 0,
    isPremium: false,
    status: 'published',
    isCommunityStory: false,
    author: 'StoryByte Team',
    tags: ['romance', 'library', 'en'],
    text: 'Maya was browsing the shelves when she spotted Arjun. They both reached for the same book... (Full story text would be here)'
  },
  {
    title: 'The Missing Key',
    description: 'A detective discovers a secret that changes everything.',
    genre: 'mystery',
    language: 'en',
    episode: 1,
    audioUrl: 'https://storage.googleapis.com/storybyte-audio/the-missing-key.mp3',
    duration: 380,
    rating: 4.2,
    plays: 0,
    isPremium: false,
    status: 'published',
    isCommunityStory: false,
    author: 'StoryByte Team',
    tags: ['mystery', 'detective', 'en'],
    text: 'The old mansion had been locked for decades. But today, someone found the key... (Full story text would be here)'
  },
  {
    title: 'अनजान दिल',
    description: 'A mysterious love story in Hindi.',
    genre: 'romance',
    language: 'hi',
    episode: 1,
    audioUrl: 'https://storage.googleapis.com/storybyte-audio/anjaan-dil.mp3',
    duration: 450,
    rating: 4.8,
    plays: 0,
    isPremium: false,
    status: 'published',
    isCommunityStory: false,
    author: 'StoryByte Team',
    tags: ['romance', 'hindi', 'hi'],
    text: 'शहर की गलियों में एक अनजान दिल की तलाश... (Full story text would be here)'
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  const batch = db.batch();
  let count = 0;

  for (const story of initialStories) {
    const docRef = db.collection('stories').doc();
    batch.set(docRef, {
      ...story,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    count++;
  }

  await batch.commit();
  console.log(`✅ Seeded ${count} stories successfully`);

  // Seed admin user if needed
  console.log('📊 Database ready!');
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });