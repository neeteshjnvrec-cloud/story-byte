/**
 * Puts a finished long episode (weekly katha or series episode) into the
 * StoryByte app as text plus its YouTube link: no audio or picture files.
 *
 * The app shows the episode's full text and a "Watch on YouTube" button
 * (src/utils/youtube.js); its cover is YouTube's own thumbnail. Nothing is
 * stored on Hosting or in the repo.
 *
 * Off until the EPISODES_IN_APP repository variable is "true": switch it on
 * once the app update that shows these is out, since older app versions try
 * to play the (missing) audio. Also needs FIREBASE_SERVICE_ACCOUNT.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const slugify = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/** The app's story id for an episode: stable, so a re-run updates it. */
function episodeStoryId({ seriesTitle, season, episode }) {
  return `long_${slugify(seriesTitle) || 'series'}_s${slugify(season) || '1'}_e${slugify(episode) || '1'}`;
}

/** The video id in a youtu.be or youtube.com link. */
function youtubeId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

async function publishEpisodeToApp({
  seriesTitle, season, episode, title, description, text, genre, language, durationSec, youtubeUrl,
}) {
  if (process.env.EPISODES_IN_APP !== 'true') {
    console.log('📱 Not added to the app (set the EPISODES_IN_APP variable to "true" once the app update is out)');
    return { skipped: 'EPISODES_IN_APP is not "true"' };
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return { skipped: 'no FIREBASE_SERVICE_ACCOUNT' };
  const videoId = youtubeId(youtubeUrl);
  if (!videoId) return { skipped: 'not on YouTube' };
  const id = episodeStoryId({ seriesTitle, season, episode });

  const saPath = path.join(os.tmpdir(), 'sb-episode-sa.json');
  fs.writeFileSync(saPath, process.env.FIREBASE_SERVICE_ACCOUNT);
  try {
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
      storyId: id, title, description: description || '', text: text || '',
      genre: genre || 'devotional', language,
      episode: String(episode), season: String(season), seriesTitle,
      duration: Math.round(durationSec || 0),
      // 1080p uploads always get this size; the custom thumbnail replaces it.
      coverImage: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      youtubeUrl: `https://youtu.be/${videoId}`, audioUrl: null,
      isLongEpisode: true, isPremium: false, priceCoins: remove(),
      isDaily: false, isCommunityStory: false, status: 'published',
      author: 'StoryByte', updatedAt: now, ...counters,
    }, { merge: true });
    console.log(`📱 In the app: stories/${id} (text + YouTube link)`);
    return { id, youtubeUrl: `https://youtu.be/${videoId}` };
  } finally {
    fs.rmSync(saPath, { force: true });
  }
}

module.exports = { publishEpisodeToApp, episodeStoryId, youtubeId };
