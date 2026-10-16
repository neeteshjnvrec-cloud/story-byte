/**
 * Puts the channel's YouTube videos into the app as stories, so likes,
 * saving, rating, comments and shares work on them like on any story.
 *
 *   1. Every long episode / weekly katha on YouTube (public/episodes/…/
 *      story.json, the same list as long-videos.json) becomes
 *      stories/yt_<videoId>: title, description, full text, YouTube link,
 *      and YouTube's thumbnail (the channel's own custom thumbnail) as cover.
 *      status is "video", not "published", so app versions from before video
 *      stories never list them (they'd try to play missing audio); the
 *      current app lists them on Home and in Community and plays them in
 *      YouTube's player.
 *   2. Daily and community stories whose YouTube video is known get
 *      youtubeId and youtubeKind "short", so their page can play it too. New
 *      ones are recorded by build-stories.js and generate-community-audio.js
 *      when they're uploaded; this fills in older ones from the weekly
 *      analytics snapshot
 *      (reports/social/latest.json), matching the Short's title to the
 *      story's socialTitle the same way scripts/analyze-social.js does.
 *
 * Idempotent; counters (plays, likes, ratings…) are only set when a video
 * story is first created. Credentials: FIREBASE_SERVICE_ACCOUNT, or a local
 * functions/firebase-service-account.json (git-ignored), as for
 * build-story-pages.js.
 *
 * Usage: node scripts/sync-video-stories.js [--dry-run]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readLongVideos } = require('./lib/site-index');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const SITE = process.env.HOSTING_SITE || `https://${process.env.FIREBASE_PROJECT_ID || 'storybyte-76716'}.web.app`;
const DRY = process.argv.includes('--dry-run');

/** The episode's full narration text, from its story.json. */
function episodeText(videoId) {
  const root = path.join(PUB, 'episodes');
  for (const file of walk(root)) {
    if (!file.endsWith('story.json')) continue;
    try {
      const s = JSON.parse(fs.readFileSync(file, 'utf8'));
      const url = String(s.published?.youtube?.url || '');
      if (s.published?.youtube?.videoId === videoId || url.endsWith(videoId)) return { text: s.text || '', genre: s.genre || '' };
    } catch {}
  }
  return { text: '', genre: '' };
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** The app's genre for an episode: devotional kathas stay devotional. */
const appGenre = (genre) => (/devot|bhakti|katha|mytholog|spiritual/i.test(genre) ? 'devotional' : (String(genre).split(/[,\s]+/)[0] || 'story').toLowerCase());

function longVideoStories() {
  return readLongVideos(PUB).map((v) => {
    const { text, genre } = episodeText(v.id);
    return {
      id: `yt_${v.id}`,
      data: {
        storyId: `yt_${v.id}`,
        title: v.title,
        description: v.description || '',
        text,
        genre: appGenre(genre || v.seriesTitle),
        seriesTitle: v.seriesTitle || '',
        season: v.season || '',
        episode: v.episode || '',
        language: v.language || 'hi',
        duration: v.durationSec || 0,
        coverImage: v.thumbnailHd || v.thumbnail,
        youtubeId: v.id,
        youtubeUrl: v.youtubeUrl,
        youtubeKind: 'long',
        pageUrl: `${SITE}/video?v=${v.id}`,
        audioUrl: null,
        status: 'video',
        isDaily: false,
        isCommunityStory: false,
        author: 'StoryByte',
      },
      publishedAt: v.publishedAt,
    };
  });
}

/**
 * [{ storyId, youtubeId }] for stories whose video is in the analytics
 * snapshot: a daily story's Short by its socialTitle, a community story's
 * video by its title (generate-community-audio.js uploads it under the
 * story's title, cut to YouTube's 100 characters). A community title that
 * matches more than one video is skipped rather than guessed.
 */
function shortsFromReport(stories) {
  let report;
  try {
    report = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports/social/latest.json'), 'utf8'));
  } catch {
    return [];
  }
  const shorts = report.youtube?.shorts || [];
  const all = [...shorts, ...(report.youtube?.videos || [])];
  const out = [];
  for (const st of stories) {
    if (st.youtubeId || !st.audioUrl) continue;
    if (st.isCommunityStory) {
      const title = String(st.title || '').slice(0, 100).trim();
      const hits = title ? [...new Set(all.filter((v) => String(v.title || '').trim() === title).map((v) => v.id))] : [];
      if (hits.length === 1 && hits[0]) out.push({ storyId: st.id, youtubeId: hits[0] });
      continue;
    }
    if (!st.socialTitle) continue;
    const hit = shorts.find((v) => String(v.title || '').startsWith(st.socialTitle));
    if (hit?.id) out.push({ storyId: st.id, youtubeId: hit.id });
  }
  return out;
}

const LOCAL_KEY = path.join(ROOT, 'functions/firebase-service-account.json');

async function main() {
  const videos = longVideoStories();
  console.log(`📺 ${videos.length} long videos`);
  const fromEnv = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!fromEnv && !fs.existsSync(LOCAL_KEY)) {
    if (DRY) videos.forEach((v) => console.log(`  ${v.id}  ${v.data.title}  (${v.data.text.length} chars of text)`));
    console.log('No FIREBASE_SERVICE_ACCOUNT or functions/firebase-service-account.json; nothing written.');
    return;
  }
  const saPath = fromEnv ? path.join(os.tmpdir(), 'sb-video-sa.json') : LOCAL_KEY;
  if (fromEnv) fs.writeFileSync(saPath, process.env.FIREBASE_SERVICE_ACCOUNT);
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
    const db = admin.firestore();
    const { FieldValue, Timestamp } = admin.firestore;

    // 1. Long videos.
    for (const v of videos) {
      const ref = db.collection('stories').doc(v.id);
      const existing = await ref.get();
      const created = v.publishedAt ? Timestamp.fromDate(new Date(v.publishedAt)) : FieldValue.serverTimestamp();
      const counters = existing.exists ? {} : {
        plays: 0, likesCount: 0, rating: 0, ratingSum: 0, ratingCount: 0, sharesCount: 0, commentsCount: 0, createdAt: created,
      };
      if (DRY) { console.log(`  ${existing.exists ? 'update' : 'create'} ${v.id}  ${v.data.title}`); continue; }
      await ref.set({ ...v.data, updatedAt: FieldValue.serverTimestamp(), ...counters }, { merge: true });
    }

    // 2. Older Shorts onto their daily stories, and community stories' videos.
    const published = await db.collection('stories').where('status', '==', 'published').get();
    const stories = published.docs.map((d) => ({ id: d.id, ...d.data() }));
    const matches = shortsFromReport(stories);
    for (const m of matches) {
      if (DRY) { console.log(`  short ${m.youtubeId} → ${m.storyId}`); continue; }
      await db.collection('stories').doc(m.storyId).update({ youtubeId: m.youtubeId, youtubeKind: 'short' });
    }
    console.log(`✅ ${videos.length} video stories ${DRY ? 'checked' : 'synced'}; ${matches.length} Shorts/videos ${DRY ? 'matched' : 'attached'} to their stories`);
  } finally {
    if (fromEnv) fs.rmSync(saPath, { force: true });
  }
}

main().catch((e) => {
  // Never fails the workflow it runs in: the day's publishing already happened.
  console.warn(`⚠️  Video stories not synced: ${e.message}`);
});
