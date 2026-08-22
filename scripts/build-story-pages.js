/**
 * Backfill shareable story pages for every already-published story.
 *
 * The two publish pipelines (build-stories.js, generate-community-audio.js) write
 * a page for each story they create, but the stories published before this
 * feature existed have none — and no `pageUrl` on their doc, so sharing them
 * would fall back to the Play Store link. This script catches them up. It is
 * idempotent: safe to re-run, and re-running after a renderer change refreshes
 * every page.
 *
 * Order of operations is load-bearing:
 *   1. write all pages into public/s/
 *   2. deploy hosting
 *   3. only then write `pageUrl` onto the story docs
 *
 * Writing `pageUrl` before the deploy would leave a window in which the app
 * hands out links that 404. Same "don't publish until the assets are reachable"
 * discipline as generate-community-audio.js.
 *
 * Env vars:
 *   FIREBASE_SERVICE_ACCOUNT — JSON string or path to a service account
 *   FIREBASE_PROJECT_ID      — default: storybyte-76716
 *   HOSTING_SITE             — default: https://{PROJECT}.web.app
 *   PLAY_STORE_URL           — override the "Get the app" target
 *   STORIES_FILTER           — process only this single story ID
 *
 * Flags:
 *   --no-deploy   render pages locally and stop; no deploy, no Firestore writes
 */
const admin = require('firebase-admin');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeStoryPage, SITE, PLAY_STORE_URL } = require('./lib/story-page');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'storybyte-76716';

const NO_DEPLOY = process.argv.includes('--no-deploy');

// --- credentials -------------------------------------------------------------
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

const SA_PATH = serviceAccountPath();
admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)) });
const db = admin.firestore();

// --- main --------------------------------------------------------------------
async function main() {
  console.log(`\n📄 Building story pages → ${SITE}/s/`);
  console.log(`   Get-the-app button → ${PLAY_STORE_URL}\n`);

  let query = db.collection('stories').where('status', '==', 'published');
  const filterId = (process.env.STORIES_FILTER || '').trim();
  if (filterId) query = query.where('storyId', '==', filterId);

  const snap = await query.get();
  if (snap.empty) {
    console.log('✅ No published stories found — nothing to do.');
    return;
  }

  const written = [];
  let skipped = 0;

  for (const docSnap of snap.docs) {
    const story = { id: docSnap.id, ...docSnap.data() };

    // No audio means no player and nothing worth sharing yet. The publish
    // pipelines set audioUrl and status together, so this should be empty in
    // practice — it's a guard against half-written docs.
    if (!story.audioUrl) {
      console.warn(`  ⚠️  skipped ${story.id} — no audioUrl`);
      skipped += 1;
      continue;
    }

    const { slug, pageUrl } = writeStoryPage(PUB, story);
    written.push({ id: story.id, title: story.title, slug, pageUrl, was: story.pageUrl || '' });
  }

  console.log(`\n✅ Rendered ${written.length} page(s)${skipped ? `, skipped ${skipped}` : ''}.`);

  // Guard against two stories claiming the same page. pageSlug ends in a digest
  // of the story ID, so this can only happen if two docs share an ID — but a
  // silent overwrite would serve one story under another's link, so say so.
  const bySlug = new Map();
  for (const w of written) {
    if (bySlug.has(w.slug)) {
      console.error(`❌ Slug collision: ${w.slug} claimed by both ${bySlug.get(w.slug)} and ${w.id}`);
      process.exitCode = 1;
    }
    bySlug.set(w.slug, w.id);
  }

  if (NO_DEPLOY) {
    console.log('\n--no-deploy: stopping here. Nothing deployed, no Firestore writes.');
    console.log(`   Pages are in ${path.join(PUB, 's')} — serve public/ locally to check them.`);
    for (const w of written.slice(0, 5)) console.log(`   ${w.slug}  ${w.title || ''}`);
    if (written.length > 5) console.log(`   … and ${written.length - 5} more`);
    return;
  }

  if (written.length === 0) {
    console.log('Nothing to deploy.');
    return;
  }

  console.log('\n🚀 Deploying pages to Firebase Hosting...');
  try {
    execFileSync(
      'npx',
      ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
      { cwd: ROOT, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SA_PATH } }
    );
    console.log('✅ Hosting deployed.');
  } catch (e) {
    console.error('❌ Hosting deploy failed:', e.message);
    console.error('   Not writing pageUrl — the pages are not reachable yet, so a');
    console.error('   shared link would 404. Re-run once the deploy succeeds.');
    process.exit(1);
  }

  // Now the pages exist, record where they live. Only docs whose pageUrl would
  // actually change are written, so a re-run after a renderer tweak costs no
  // Firestore quota.
  const stale = written.filter((w) => w.was !== w.pageUrl);
  if (stale.length === 0) {
    console.log('\n✅ Every story already had the right pageUrl — no Firestore writes needed.');
    return;
  }

  console.log(`\n📝 Writing pageUrl on ${stale.length} story doc(s)...`);
  // Batches cap at 500 writes.
  for (let i = 0; i < stale.length; i += 400) {
    const chunk = stale.slice(i, i + 400);
    const batch = db.batch();
    for (const w of chunk) {
      batch.update(db.collection('stories').doc(w.id), {
        pageUrl: w.pageUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log(`  ✓ ${Math.min(i + chunk.length, stale.length)}/${stale.length}`);
  }

  console.log('\n✅ Done. Try one:');
  console.log(`   ${stale[0].pageUrl}`);
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((e) => {
    console.error('\n❌ build-story-pages failed:', e);
    process.exit(1);
  });
