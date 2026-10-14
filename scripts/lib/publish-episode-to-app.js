/**
 * Puts a finished 15-minute episode into the StoryByte app as a paid
 * episode that listeners unlock with coins (src/services/wallet.js).
 *
 *   - The audio is copied to public/premium/<random token>/audio.mp3 and
 *     deployed with Firebase Hosting. The address is unguessable, and only
 *     premium_audio/{id} holds it, which the Firestore rules let only
 *     listeners who unlocked the episode read.
 *   - A square cover is cut from one of the episode's scene pictures.
 *   - stories/{id} gets the public details (no audio address) with
 *     isLongEpisode and priceCoins, which the coin rules read the price from.
 *
 * The caller's workflow commits public/premium and public/covers, so the
 * daily Hosting deploy (which serves the repository's public/ folder) keeps
 * the files online.
 *
 * Off until the EPISODES_IN_APP repository variable is "true": switch it on
 * once the coin rules are deployed and the app update with coins is out,
 * since older app versions can't play a paid episode. Also needs
 * FIREBASE_SERVICE_ACCOUNT. EPISODE_PRICE_COINS sets the price (default 10).
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'storybyte-76716';
const SITE = process.env.HOSTING_SITE || `https://${PROJECT}.web.app`;

const slugify = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/** The app's story id for an episode: stable, so a re-run updates it. */
function episodeStoryId({ seriesTitle, season, episode }) {
  return `long_${slugify(seriesTitle) || 'series'}_s${slugify(season) || '1'}_e${slugify(episode) || '1'}`;
}

async function publishEpisodeToApp({
  root, seriesTitle, season, episode, title, description, genre, language,
  durationSec, audioPath, coverSource, youtubeUrl,
}) {
  if (process.env.EPISODES_IN_APP !== 'true') {
    console.log('📱 Not added to the app (set the EPISODES_IN_APP variable to "true" once the coins update is live)');
    return { skipped: 'EPISODES_IN_APP is not "true"' };
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return { skipped: 'no FIREBASE_SERVICE_ACCOUNT' };
  const price = Math.max(1, Math.round(Number(process.env.EPISODE_PRICE_COINS) || 10));
  const id = episodeStoryId({ seriesTitle, season, episode });
  const pub = path.join(root, 'public');

  // Audio at an unguessable address, and a 768x768 cover.
  const token = crypto.randomBytes(16).toString('hex');
  const audioRel = `premium/${token}/audio.mp3`;
  fs.mkdirSync(path.join(pub, 'premium', token), { recursive: true });
  fs.copyFileSync(audioPath, path.join(pub, audioRel));
  const coverRel = `covers/${id}.jpg`;
  fs.mkdirSync(path.join(pub, 'covers'), { recursive: true });
  await sharp(coverSource).resize(768, 768, { fit: 'cover', position: 'attention' }).jpeg({ quality: 88 }).toFile(path.join(pub, coverRel));

  const saPath = path.join(os.tmpdir(), 'sb-episode-sa.json');
  fs.writeFileSync(saPath, process.env.FIREBASE_SERVICE_ACCOUNT);
  try {
    // Deploy first, so the audio is online before the app can see the episode.
    execFileSync('npx', ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
      { cwd: root, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: saPath } });

    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = db.collection('stories').doc(id);
    const existing = await ref.get();
    // A re-run of the same episode replaces its audio but keeps its counts.
    const counters = existing.exists ? {} : { plays: 0, likesCount: 0, rating: 0, ratingSum: 0, ratingCount: 0, sharesCount: 0, createdAt: now };
    await ref.set({
      storyId: id, title, description: description || '', genre: genre || 'devotional', language,
      episode: String(episode), season: String(season), seriesTitle,
      duration: Math.round(durationSec || 0), coverImage: `${SITE}/${coverRel}`,
      audioUrl: null, isPremium: true, isLongEpisode: true, priceCoins: price,
      isDaily: false, isCommunityStory: false, status: 'published',
      youtubeUrl: youtubeUrl || null, author: 'StoryByte', updatedAt: now, ...counters,
    }, { merge: true });
    await db.collection('premium_audio').doc(id).set({ audioUrl: `${SITE}/${audioRel}`, updatedAt: now });
    console.log(`📱 In the app as a paid episode (${price} coins): stories/${id}`);
    return { id, price, audioRel, coverRel };
  } finally {
    fs.rmSync(saPath, { force: true });
  }
}

module.exports = { publishEpisodeToApp, episodeStoryId };
