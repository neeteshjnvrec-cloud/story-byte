/**
 * Fills in the real author name on community stories saved as "Anonymous".
 *
 * The app saved "Anonymous" when the profile had no full name yet (a
 * Google sign-in's name wasn't copied into it), and the app can't look the
 * name up itself: user profiles are private (firestore.rules.json). With
 * admin credentials this reads the author's profile, users/<authorId>, and
 * writes its name (full name, else the Google name) onto their stories,
 * plus their photo when the story has none. Only touches stories that
 * still say Anonymous, so it's safe to run any number of times.
 *
 * Used by generate-community-audio.js (every hourly run) and
 * fix-author-names.js (run it by hand to fix them right away).
 */
const ANON = ['Anonymous', ''];

async function backfillAuthorNames(db, { dryRun = false, log = () => {} } = {}) {
  const snap = await db.collection('stories')
    .where('isCommunityStory', '==', true)
    .where('authorName', 'in', ANON)
    .get();
  const profiles = new Map();
  const result = { found: snap.size, fixed: 0, noName: 0, noAuthor: 0 };
  for (const doc of snap.docs) {
    const { authorId, authorProfilePic, title } = doc.data();
    if (!authorId) { result.noAuthor++; continue; }
    if (!profiles.has(authorId)) {
      const u = await db.collection('users').doc(authorId).get().catch(() => null);
      profiles.set(authorId, u?.exists ? u.data() : null);
    }
    const u = profiles.get(authorId);
    const name = String(u?.fullName || u?.displayName || '').trim().slice(0, 60);
    if (!name) { result.noName++; log(`  – "${title}": the author's profile has no name`); continue; }
    const update = { authorName: name };
    const pic = u.profilePic || u.photoURL;
    if (!authorProfilePic && pic) update.authorProfilePic = pic;
    log(`  ✓ "${title}" → ${name}${update.authorProfilePic ? ' (+ photo)' : ''}`);
    if (!dryRun) await doc.ref.update(update);
    result.fixed++;
  }
  return result;
}

module.exports = { backfillAuthorNames };
