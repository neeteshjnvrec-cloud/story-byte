/**
 * Puts the real author name on community stories saved as "Anonymous",
 * right now (the hourly community job does the same on every run; see
 * lib/author-names.js). Only names and photos change; nothing else is
 * touched, nothing is deployed and nothing is posted.
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT, or a local
 * functions/firebase-service-account.json (git-ignored), as for
 * sync-video-stories.js.
 *
 * Usage: node scripts/fix-author-names.js [--dry-run]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { backfillAuthorNames } = require('./lib/author-names');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_KEY = path.join(ROOT, 'functions/firebase-service-account.json');
const DRY = process.argv.includes('--dry-run');

async function main() {
  const fromEnv = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!fromEnv && !fs.existsSync(LOCAL_KEY)) {
    console.error('No FIREBASE_SERVICE_ACCOUNT or functions/firebase-service-account.json.');
    process.exit(1);
  }
  const saPath = fromEnv ? path.join(os.tmpdir(), 'sb-names-sa.json') : LOCAL_KEY;
  if (fromEnv) fs.writeFileSync(saPath, process.env.FIREBASE_SERVICE_ACCOUNT);
  try {
    const admin = require('firebase-admin');
    admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
    const r = await backfillAuthorNames(admin.firestore(), { dryRun: DRY, log: console.log });
    console.log(`\n${DRY ? '🔎 Would fix' : '✅ Fixed'} ${r.fixed} of ${r.found} "Anonymous" stories` +
      (r.noName ? `; ${r.noName} stay Anonymous (no name in the author's profile)` : '') +
      (r.noAuthor ? `; ${r.noAuthor} have no author saved` : ''));
  } finally {
    if (fromEnv) fs.rmSync(saPath, { force: true });
  }
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
