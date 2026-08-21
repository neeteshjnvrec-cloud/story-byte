/**
 * Notification delivery for the pipeline scripts.
 *
 * Two channels, both required — they are not interchangeable:
 *
 *   1. In-app: one Firestore doc per recipient under `users/{uid}/notifications`.
 *      This is the only path the app reads (notificationService.subscribe), and
 *      it is what drives the bell badge and the Notifications screen. It works
 *      with no native configuration.
 *
 *   2. Push: the Expo Push API. The app registers *Expo* push tokens
 *      (ExponentPushToken[...]), which admin.messaging() cannot deliver — that
 *      needs native FCM/APNs credentials the project doesn't have. Sending via
 *      exp.host needs no credentials at all.
 *
 * Both broadcast helpers share a single pass over the `users` collection, so a
 * fan-out costs N document reads and N writes, not 2N reads.
 */
const admin = require('firebase-admin');

const BATCH_SIZE = 500;               // Firestore batched-write limit
const EXPO_PUSH_CHUNK = 100;          // Expo Push API limit per request
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Hard ceiling on a single fan-out. Spark allows 20k writes/day, and a
// broadcast costs one write per user per story — so this is worth bounding.
// Truncation is logged loudly rather than silently swallowed.
const MAX_FANOUT_USERS = Number(process.env.MAX_FANOUT_USERS || 5000);

const isExpoToken = (t) => typeof t === 'string' && t.startsWith('ExponentPushToken[');

/** Write one in-app notification into users/{uid}/notifications. */
async function notifyUser(db, uid, payload) {
  if (!uid) return false;
  try {
    await db.collection('users').doc(uid).collection('notifications').add({
      ...payload,
      userId: uid,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn(`  ⚠️  notifyUser(${uid}) failed: ${e.message}`);
    return false;
  }
}

/**
 * Fan out one in-app notification per user.
 *
 * Returns { written, skipped, truncated, tokens } — `tokens` are the Expo push
 * tokens gathered during the same pass, ready to hand to sendExpoPush so the
 * caller doesn't re-read the collection.
 */
async function notifyAllUsers(db, payload, { excludeUid = null } = {}) {
  const snap = await db.collection('users').get();

  let batch = db.batch();
  let batched = 0;
  let written = 0;
  let skipped = 0;
  let considered = 0;
  let truncated = 0;
  const tokens = [];

  for (const userDoc of snap.docs) {
    if (userDoc.id === excludeUid) { skipped += 1; continue; }

    if (considered >= MAX_FANOUT_USERS) { truncated += 1; continue; }
    considered += 1;

    const token = userDoc.data().pushToken;
    if (isExpoToken(token)) tokens.push(token);

    batch.set(
      userDoc.ref.collection('notifications').doc(),
      {
        ...payload,
        userId: userDoc.id,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }
    );
    batched += 1;
    written += 1;

    if (batched === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batched = 0;
    }
  }

  if (batched > 0) await batch.commit();

  console.log(`  📢 in-app fan-out: ${written} user(s)${skipped ? `, ${skipped} excluded` : ''}, ${tokens.length} push token(s)`);
  if (truncated > 0) {
    console.warn(`  ⚠️  FAN-OUT TRUNCATED: ${truncated} user(s) received nothing (MAX_FANOUT_USERS=${MAX_FANOUT_USERS})`);
  }

  return { written, skipped, truncated, tokens };
}

/** Read one user's Expo push token, falling back to the legacy subcollection. */
async function tokenForUser(db, uid) {
  if (!uid) return null;
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    const fromDoc = userSnap.exists ? userSnap.data().pushToken : null;
    if (isExpoToken(fromDoc)) return fromDoc;

    // Users who haven't relaunched since the token moved onto the user doc.
    const legacy = await db.collection('users').doc(uid).collection('push_tokens').get();
    for (const d of legacy.docs) {
      if (isExpoToken(d.data().token)) return d.data().token;
    }
  } catch (e) {
    console.warn(`  ⚠️  tokenForUser(${uid}) failed: ${e.message}`);
  }
  return null;
}

/**
 * Send a push via the Expo Push API. No-ops (with a log) when there are no
 * tokens, which is the normal state until users grant permission on a build
 * that can actually register — silence here would look like success.
 */
async function sendExpoPush(tokens, { title, body, data = {} }) {
  const valid = [...new Set((tokens || []).filter(isExpoToken))];
  if (valid.length === 0) {
    console.log('  🔔 push skipped: no registered Expo tokens');
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < valid.length; i += EXPO_PUSH_CHUNK) {
    const chunk = valid.slice(i, i + EXPO_PUSH_CHUNK);
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      data,
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(`  ⚠️  Expo push HTTP ${res.status}: ${text.slice(0, 300)}`);
        failed += chunk.length;
        continue;
      }

      const json = await res.json();
      for (const ticket of json.data || []) {
        if (ticket.status === 'ok') sent += 1;
        else {
          failed += 1;
          console.warn(`  ⚠️  push ticket error: ${ticket.message || 'unknown'}`);
        }
      }
    } catch (e) {
      console.warn(`  ⚠️  Expo push request failed: ${e.message}`);
      failed += chunk.length;
    }
  }

  console.log(`  🔔 push: ${sent} delivered, ${failed} failed (${valid.length} token(s))`);
  return { sent, failed };
}

/** In-app notification + push for a single user. */
async function notifyAndPushUser(db, uid, payload, push) {
  await notifyUser(db, uid, payload);
  const token = await tokenForUser(db, uid);
  await sendExpoPush(token ? [token] : [], push);
}

/** In-app fan-out + push to everyone, in one pass over `users`. */
async function notifyAndPushAll(db, payload, push, { excludeUid = null } = {}) {
  const { tokens } = await notifyAllUsers(db, payload, { excludeUid });
  await sendExpoPush(tokens, push);
}

module.exports = {
  notifyUser,
  notifyAllUsers,
  tokenForUser,
  sendExpoPush,
  notifyAndPushUser,
  notifyAndPushAll,
  MAX_FANOUT_USERS,
};
