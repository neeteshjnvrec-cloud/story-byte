/**
 * Security-rule tests for stories, comments and config
 * (firestore/firestore.rules.json): what the app writes, and the forged
 * writes a modified client could try. Runs the same way as
 * coins.rules.test.mjs.
 */
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, writeBatch, serverTimestamp, increment, collection, addDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-stories',
  firestore: { rules: readFileSync(new URL('../firestore.rules.json', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085 },
});
const db = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

test.beforeEach(async () => { await env.clearFirestore(); });
test.after(async () => { await env.cleanup(); });

// The doc publishCommunityStory (src/services/api.js) writes.
function communityStory(uid, over = {}) {
  return {
    storyId: 's1', title: 'T', description: 'D', genre: 'fantasy', language: 'en', text: 'Once upon a time',
    audioUrl: '', coverImage: 'https://image.pollinations.ai/x', duration: 0, authorName: 'Alice', authorId: uid,
    authorProfilePic: '', isCommunityStory: true, status: 'under_review', likesCount: 0, plays: 0, rating: 0,
    ratingSum: 0, ratingCount: 0, sharesCount: 0, tags: ['fantasy'], modelUsed: 'm', ttsEngine: 'edge-tts',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over,
  };
}
function publish(f, uid, over) {
  const now = new Date();
  const key = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  const b = writeBatch(f);
  b.set(doc(f, 'stories', 's1'), communityStory(uid, over));
  b.set(doc(f, 'dailyStoryCounts', `${uid}_${key}`), { count: increment(1), updatedAt: serverTimestamp() }, { merge: true });
  return b.commit();
}

test('a community story starts unpublished, without audio, at zero', async () => {
  const f = db('alice');
  await assertFails(publish(f, 'alice', { status: 'published' }));
  await assertFails(publish(f, 'alice', { audioUrl: 'https://evil.example/a.mp3' }));
  await assertFails(publish(f, 'alice', { plays: 100000 }));
  await assertFails(publish(f, 'alice', { isLongEpisode: true, priceCoins: 1 }));
  await assertFails(publish(f, 'bob'));
  await assertSucceeds(publish(f, 'alice'));
});

test('counters move by one per write', async () => {
  await seed((f) => setDoc(doc(f, 'stories', 's1'), { title: 'T', plays: 5, likesCount: 2, sharesCount: 0 }));
  const s = doc(db('alice'), 'stories', 's1');
  await assertSucceeds(updateDoc(s, { plays: increment(1), lastPlayedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(s, { sharesCount: increment(1), lastSharedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(s, { likesCount: increment(1), lastLikedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(s, { likesCount: increment(-1) }));
  await assertSucceeds(updateDoc(s, { commentsCount: increment(1) }));
  await assertFails(updateDoc(s, { plays: 1000000 }));
  await assertFails(updateDoc(s, { plays: increment(-1) }));
  await assertFails(updateDoc(s, { likesCount: increment(50) }));
  await assertFails(updateDoc(s, { title: 'Hacked' }));
  await assertFails(updateDoc(doc(anon(), 'stories', 's1'), { plays: increment(1) }));
});

test('ratings add or swap one 1-5 score', async () => {
  await seed((f) => setDoc(doc(f, 'stories', 's1'), { rating: 4, ratingSum: 8, ratingCount: 2 }));
  const s = doc(db('alice'), 'stories', 's1');
  await assertSucceeds(updateDoc(s, { ratingSum: 13, ratingCount: 3, rating: 4.3, lastRatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(s, { ratingSum: 9, ratingCount: 3, rating: 3, lastRatedAt: serverTimestamp() }));
  await assertFails(updateDoc(s, { ratingSum: 509, ratingCount: 103, rating: 5 }));
  await assertFails(updateDoc(s, { ratingSum: 9, ratingCount: 3, rating: 99 }));
  await assertFails(updateDoc(s, { lastReview: 'x'.repeat(1001) }));

  // A story rated before ratingSum existed: the first new rating starts over.
  await seed((f) => setDoc(doc(f, 'stories', 's2'), { rating: 3, ratingCount: 7 }));
  await assertSucceeds(updateDoc(doc(db('alice'), 'stories', 's2'), { ratingSum: 5, ratingCount: 1, rating: 5 }));
});

test("comments carry their writer's own uid", async () => {
  await seed((f) => setDoc(doc(f, 'stories', 's1'), { title: 'T' }));
  const f = db('alice');
  const c = collection(f, 'stories', 's1', 'comments');
  const comment = (over = {}) => ({ authorId: 'alice', authorName: 'Alice', authorPic: '', text: 'Nice', createdAt: serverTimestamp(), ...over });
  await assertFails(addDoc(c, comment({ authorId: 'bob' })));
  await assertFails(addDoc(c, comment({ text: '' })));
  await assertFails(addDoc(c, comment({ text: 'x'.repeat(2001) })));
  await assertFails(addDoc(c, comment({ pinned: true })));
  await assertFails(addDoc(collection(anon(), 'stories', 's1', 'comments'), comment()));
  const ref = await assertSucceeds(addDoc(c, comment()));
  await assertFails(deleteDoc(doc(db('bob'), 'stories', 's1', 'comments', ref.id)));
  await assertSucceeds(deleteDoc(doc(f, 'stories', 's1', 'comments', ref.id)));
});

test('config: the GitHub token is unreadable, Groq keys need an account', async () => {
  await seed(async (f) => {
    await setDoc(doc(f, 'config', 'github'), { token: 'secret' });
    await setDoc(doc(f, 'config', 'groq_settings'), { apiKeys: ['k'] });
    await setDoc(doc(f, 'config', 'app'), { minVersion: '2.1.0' });
  });
  await assertFails(getDoc(doc(anon(), 'config', 'github')));
  await assertFails(getDoc(doc(db('alice'), 'config', 'github')));
  await assertFails(getDoc(doc(anon(), 'config', 'groq_settings')));
  await assertSucceeds(getDoc(doc(db('alice'), 'config', 'groq_settings')));
  await assertSucceeds(getDoc(doc(anon(), 'config', 'app')));
  await assertFails(setDoc(doc(db('alice'), 'config', 'app'), { minVersion: '0' }));
});
