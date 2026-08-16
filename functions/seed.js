/**
 * Seed Firestore with sample stories (runs on the free Spark plan).
 *
 * Run from the functions/ directory (where firebase-admin and the service
 * account live):
 *
 *   cd functions && node seed.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

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
    status: 'active',
    author: 'StoryByte Team',
    tags: ['romance', 'library', 'en'],
    text: 'Maya was browsing the shelves when she spotted Arjun. They both reached for the same book...'
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
    status: 'active',
    author: 'StoryByte Team',
    tags: ['mystery', 'detective', 'en'],
    text: 'The old mansion had been locked for decades. But today, someone found the key...'
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
    status: 'active',
    author: 'StoryByte Team',
    tags: ['romance', 'hindi', 'hi'],
    text: 'शहर की गलियों में एक अनजान दिल की तलाश...'
  }
];

async function seed() {
  console.log('🌱 Seeding stories...');
  const batch = db.batch();
  for (const story of initialStories) {
    const ref = db.collection('stories').doc();
    batch.set(ref, {
      ...story,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
  console.log(`✅ Seeded ${initialStories.length} stories`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
