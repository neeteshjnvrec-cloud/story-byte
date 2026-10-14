/**
 * Puts a finished long episode (weekly katha or series episode) into the
 * StoryByte app, free, by link only.
 *
 * The episode's audio and pictures are already in public/episodes/… (the
 * workflow commits them and Hosting serves them), so the app's story just
 * points at those files: nothing is copied. Hosting is deployed first so the
 * links work before the app can see the episode.
 *
 * On by default; the EPISODES_IN_APP repository variable set to "false"
 * turns it off. Needs FIREBASE_SERVICE_ACCOUNT.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'storybyte-76716';
const SITE = process.env.HOSTING_SITE || `https://${PROJECT}.web.app`;

const slugify = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/** The app's story id for an episode: stable, so a re-run updates it. */
function episodeStoryId({ seriesTitle, season, episode }) {
  return `long_${slugify(seriesTitle) || 'series'}_s${slugify(season) || '1'}_e${slugify(episode) || '1'}`;
}

/** The website address of a file inside public/, or null if it's elsewhere. */
function siteUrlFor(pubDir, file) {
  if (!file) return null;
  const rel = path.relative(pubDir, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return `${SITE}/${rel.split(path.sep).map(encodeURIComponent).join('/')}`;
}

async function publishEpisodeToApp({
  root, seriesTitle, season, episode, title, description, genre, language,
  durationSec, audioPath, coverSource, youtubeUrl,
}) {
  if (process.env.EPISODES_IN_APP === 'false') return { skipped: 'EPISODES_IN_APP is "false"' };
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return { skipped: 'no FIREBASE_SERVICE_ACCOUNT' };
  const pub = path.join(root, 'public');
  const audioUrl = siteUrlFor(pub, audioPath);
  if (!audioUrl || !fs.existsSync(audioPath)) return { skipped: 'the audio is not in public/' };
  const coverImage = siteUrlFor(pub, coverSource);
  const id = episodeStoryId({ seriesTitle, season, episode });

  const saPath = path.join(os.tmpdir(), 'sb-episode-sa.json');
  fs.writeFileSync(saPath, process.env.FIREBASE_SERVICE_ACCOUNT);
  try {
    // Deploy first, so the audio is online before the app can see the episode.
    execFileSync('npx', ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
      { cwd: root, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: saPath } });

    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
    const db = admin.firestore();
    const { serverTimestamp, delete: remove } = admin.firestore.FieldValue;
    const now = serverTimestamp();
    const ref = db.collection('stories').doc(id);
    const existing = await ref.get();
    // A re-run of the same episode updates it but keeps its counts.
    const counters = existing.exists ? {} : { plays: 0, likesCount: 0, rating: 0, ratingSum: 0, ratingCount: 0, sharesCount: 0, createdAt: now };
    await ref.set({
      storyId: id, title, description: description || '', genre: genre || 'devotional', language,
      episode: String(episode), season: String(season), seriesTitle,
      duration: Math.round(durationSec || 0), coverImage, audioUrl,
      isLongEpisode: true, isPremium: false, priceCoins: remove(),
      isDaily: false, isCommunityStory: false, status: 'published',
      youtubeUrl: youtubeUrl || null, author: 'StoryByte', updatedAt: now, ...counters,
    }, { merge: true });
    console.log(`📱 In the app: stories/${id} → ${audioUrl}`);
    return { id, audioUrl, coverImage };
  } finally {
    fs.rmSync(saPath, { force: true });
  }
}

module.exports = { publishEpisodeToApp, episodeStoryId, siteUrlFor };
