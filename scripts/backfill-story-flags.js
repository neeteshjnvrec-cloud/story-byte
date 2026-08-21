/**
 * One-time (idempotent) backfill for the unified story lifecycle.
 *
 * Home and Community read the same `stories` collection and differ only by
 * `isCommunityStory`. That only works if every doc actually carries the field —
 * daily stories written by build-stories.js never did, so a query for
 * `isCommunityStory == false` matched zero docs. This fills the gap and retires
 * the old `status: 'active'` vocabulary in favour of `published`.
 *
 * Safe to re-run: each doc is only touched if something is actually missing.
 *
 * Env vars:
 *   FIREBASE_SERVICE_ACCOUNT — JSON string or path to service account (optional
 *                              if functions/firebase-service-account.json exists)
 *   FIREBASE_PROJECT_ID      — default: storybyte-76716
 *   DRY_RUN                  — set to 1 to report without writing
 */
const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.env.DRY_RUN === '1';

function serviceAccountPath() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const p = path.join(os.tmpdir(), 'sb-sa.json');
    fs.writeFileSync(p, process.env.FIREBASE_SERVICE_ACCOUNT);
    return p;
  }
  const local = path.join(ROOT, 'functions/firebase-service-account.json');
  if (fs.existsSync(local)) return local;
  throw new Error('No Firebase credentials — set FIREBASE_SERVICE_ACCOUNT env var');
}

admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath())) });
const db = admin.firestore();

// Aggregates that must exist as numbers so the metrics store has something to
// read. The app has read-side fallbacks either way; this just stops every doc
// from relying on them forever.
const AGGREGATES = ['plays', 'likesCount', 'rating', 'ratingSum', 'ratingCount'];

const BATCH_SIZE = 500;

async function main() {
  const snap = await db.collection('stories').get();
  console.log(`\nScanning ${snap.size} story doc(s)${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const counts = { flagAdded: 0, statusMigrated: 0, aggregatesFilled: 0, untouched: 0 };
  let batch = db.batch();
  let batched = 0;
  let committed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const update = {};

    if (typeof data.isCommunityStory !== 'boolean') {
      // Absence means "not community" — every community story has always been
      // written with the flag set to true by publishCommunityStory.
      update.isCommunityStory = false;
      counts.flagAdded += 1;
    }

    if (data.status === 'active') {
      update.status = 'published';
      counts.statusMigrated += 1;
    }

    let filledAggregate = false;
    for (const field of AGGREGATES) {
      if (typeof data[field] !== 'number') {
        update[field] = 0;
        filledAggregate = true;
      }
    }
    if (filledAggregate) counts.aggregatesFilled += 1;

    // `playsCount` was a dead parallel field: publishCommunityStory initialised
    // it but every increment wrote `plays`. Fold any stray value forward rather
    // than losing it, then leave the field alone (deleting is not worth a rules
    // change on Spark).
    if (typeof data.playsCount === 'number' && data.playsCount > (update.plays ?? data.plays ?? 0)) {
      update.plays = data.playsCount;
    }

    if (Object.keys(update).length === 0) {
      counts.untouched += 1;
      continue;
    }

    if (!DRY_RUN) {
      batch.update(docSnap.ref, update);
      batched += 1;
      if (batched === BATCH_SIZE) {
        await batch.commit();
        committed += batched;
        console.log(`  committed ${committed} update(s)...`);
        batch = db.batch();
        batched = 0;
      }
    }
  }

  if (!DRY_RUN && batched > 0) {
    await batch.commit();
    committed += batched;
  }

  console.log('\nDone.');
  console.log(`  isCommunityStory: false added   ${counts.flagAdded}`);
  console.log(`  status active -> published      ${counts.statusMigrated}`);
  console.log(`  docs with aggregates filled     ${counts.aggregatesFilled}`);
  console.log(`  already correct                 ${counts.untouched}`);
  console.log(`  docs written                    ${DRY_RUN ? 0 : committed}\n`);
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
