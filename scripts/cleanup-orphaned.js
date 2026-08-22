// Cleanup orphan stories that never reached 'published' or have no audio.
// Usage: FIREBASE_SERVICE_ACCOUNT=<path> node scripts/cleanup-orphaned.js [storyId]
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const storyId = process.argv[2];

function clean(id) {
  const audio = path.join('public/audio', `${id}.mp3`);
  const cover = path.join('public/covers', `${id}.jpg`);
  const page = path.join('public/s', `${id}.html`);
  if (fs.existsSync(audio)) { fs.unlinkSync(audio); console.log('rm audio', id); }
  if (fs.existsSync(cover)) { fs.unlinkSync(cover); console.log('rm cover', id); }
  if (fs.existsSync(page)) { fs.unlinkSync(page); console.log('rm page', id); }
}

async function main() {
  const service = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!service || !fs.existsSync(service)) { console.error('FIREBASE_SERVICE_ACCOUNT missing'); process.exit(1); }
  initializeApp({ credential: cert(service) });
  const db = getFirestore();
  if (storyId) {
    await db.collection('stories').doc(storyId).delete();
    clean(storyId);
    console.log('deleted', storyId);
    return;
  }
  const snap = await db.collection('stories').where('status', '!=', 'published').get();
  for (const doc of snap.docs) {
    const id = doc.id;
    await db.collection('stories').doc(id).delete();
    clean(id);
  }
}
main();
