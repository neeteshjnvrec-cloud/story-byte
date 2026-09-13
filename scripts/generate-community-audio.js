/**
 * Community Story Audio Generator — standalone script for GitHub Actions.
 *
 * The single owner of the community story lifecycle. Processes community stories
 * with status 'under_review' (or 'failed', so transient failures are retried),
 * generates a cover image + audio narration, deploys to Firebase Hosting, then
 * flips status to 'published' — the point at which the story becomes visible to
 * anyone at all — and sends two notifications:
 *   1. To the publisher (authorId) — "Your story is live!"
 *   2. Broadcast to every other user — "New story by [author]"
 *
 * Notifications go to users/{uid}/notifications, one doc per recipient, which is
 * the only path the app reads. Push goes through the Expo Push API; see
 * lib/notify.js for why admin.messaging() can't be used here.
 *
 * Env vars:
 *   GROQ_API_KEY        — optional, used only if story needs text regeneration
 *   FIREBASE_SERVICE_ACCOUNT — JSON string or path to service account
 *   FIREBASE_PROJECT_ID — default: storybyte-76716
 *   STORIES_FILTER      — if set, process only this single story ID
 *   MAX_FANOUT_USERS    — ceiling on broadcast recipients (default 5000)
 */
const admin = require('firebase-admin');
const { execFileSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { notifyAndPushUser, notifyAndPushAll } = require('./lib/notify');
const { writeStoryPage } = require('./lib/story-page');
const { buildCarouselSlides } = require('./lib/carousel-slides');
const { postStoryCarousel } = require('./lib/instagram');
const { postStoryToFacebook } = require('./lib/facebook');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'storybyte-76716';
const SITE = `https://${PROJECT}.web.app`;

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

// --- helpers -----------------------------------------------------------------
const slug = (s) =>
  (s || 'story').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

const hashSeed = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function coverPrompt(story) {
  const mood = story.genre === 'sleep' ? 'calm dreamy nighttime, soft moonlight'
    : story.genre === 'romance' ? 'warm golden tender'
    : story.genre === 'mystery' ? 'moody atmospheric, muted tones'
    : story.genre === 'devotional' ? 'divine and serene, Indian mythology art style, temple and nature imagery, soft golden glow'
    : story.genre === 'motivation' ? 'bright, uplifting, golden hour light'
    : story.genre === 'adventure' ? 'sweeping, sunlit, epic vistas'
    : story.genre === 'drama' ? 'warm cinematic, earthy tones'
    : 'warm cinematic storybook';
  // Devotional stories are often about a specific deity/figure the user named
  // in the title (e.g. "Krishna") — say so explicitly, since the description
  // alone is often too abstract ("a story about faith and love") for the
  // image model to draw anything devotional-looking from.
  const subject = story.genre === 'devotional' ? (story.title || story.description || '') : (story.description || story.title || '');
  return `${subject}. Storybook cover illustration, ${mood}, painterly, cozy, high detail, no text`;
}

function fetchImage(url, out) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(out);
    https.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      res.pipe(f);
      f.on('finish', () => f.close(() => resolve()));
    }).on('error', reject).on('timeout', () => this.destroy(new Error('timeout')));
  });
}

const EDGE = [
  ['edge-tts', []],
  ['python3', ['-m', 'edge_tts']],
  ['uvx', ['edge-tts']],
];

// One edge-tts voice per language offered by the creation-time picker
// (src/types/story.js LANGUAGES). Keep the two lists in sync.
const VOICES = {
  en: 'en-US-AriaNeural',
  hi: 'hi-IN-SwaraNeural',
  es: 'es-MX-DaliaNeural',
  fr: 'fr-FR-DeniseNeural',
  de: 'de-DE-KatjaNeural',
  it: 'it-IT-ElsaNeural',
  pt: 'pt-BR-FranciscaNeural',
  // Indian-language neural voices, matching the creation-time picker.
  bn: 'bn-IN-TanishaaNeural',
  mr: 'mr-IN-AarohiNeural',
  te: 'te-IN-ShrutiNeural',
  ta: 'ta-IN-PallaviNeural',
  gu: 'gu-IN-DhwaniNeural',
  ur: 'ur-IN-GulNeural',
  kn: 'kn-IN-SapnaNeural',
  or: 'or-IN-SubhasiniNeural',
  ml: 'ml-IN-SobhanaNeural',
};

function synth(text, voice, out) {
  const txt = path.join(os.tmpdir(), `sb-${Date.now()}.txt`);
  fs.writeFileSync(txt, text, 'utf8');
  const args = ['--voice', voice, '--file', txt, '--write-media', out];
  let ok = false, err;
  for (const [cmd, pre] of EDGE) {
    try {
      if (fs.existsSync(out)) fs.unlinkSync(out);
      execFileSync(cmd, [...pre, ...args], { stdio: 'pipe' });
      if (fs.existsSync(out) && fs.statSync(out).size > 1024) { ok = true; break; }
    } catch (e) { err = e; }
  }
  try { fs.unlinkSync(txt); } catch (e) {}
  if (!ok) throw new Error('edge-tts failed: ' + (err?.message ?? 'unknown'));
}

function durationSec(file) {
  try {
    return Math.round(
      parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
        .toString().trim())
    ) || 0;
  } catch { return 0; }
}

// --- notifications -----------------------------------------------------------
// Both of these previously wrote to a top-level `notifications` collection that
// the app never reads — it subscribes to users/{uid}/notifications. lib/notify
// writes there instead, one doc per recipient.

async function sendPublisherNotification(story) {
  const authorId = story.authorId;
  if (!authorId) {
    console.warn('  ⚠️  No authorId on story — publisher notification skipped');
    return;
  }

  await notifyAndPushUser(
    db,
    authorId,
    {
      type: 'story_published',
      title: 'Your story is live! 🎉',
      body: `"${story.title}" has been reviewed and published — it's now available to all listeners.`,
      storyId: story.storyId,
      genre: story.genre,
      coverImage: story.coverImage,
    },
    {
      title: 'Your story is live! 🎉',
      body: `"${story.title}" is now available.`,
      data: { storyId: story.storyId, type: 'story_published', navigateTo: 'StoryDetail' },
    }
  );
}

async function sendBroadcastNotification(story) {
  // Everyone except the author, who already got the "your story is live" one.
  await notifyAndPushAll(
    db,
    {
      type: 'new_community_story',
      title: `New story by ${story.authorName || 'a StoryByte listener'}`,
      body: `"${story.title}" · ${story.genre}`,
      storyId: story.storyId,
      authorName: story.authorName,
      authorId: story.authorId,
      genre: story.genre,
      coverImage: story.coverImage,
    },
    {
      title: `New story by ${story.authorName || 'a StoryByte listener'}`,
      body: `"${story.title}" · ${story.genre}`,
      data: { storyId: story.storyId, type: 'new_community_story', navigateTo: 'StoryDetail' },
    },
    { excludeUid: story.authorId }
  );
}

// --- main --------------------------------------------------------------------
async function main() {
  fs.mkdirSync(path.join(PUB, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(PUB, 'covers'), { recursive: true });
  // Shareable story pages, staged alongside the audio and covers so the single
  // hosting deploy below carries them too.
  fs.mkdirSync(path.join(PUB, 's'), { recursive: true });

  // Determine which stories to process.
  // 'failed' is included so a transient cover/TTS failure is retried on the next
  // run instead of stranding the story as permanently invisible.
  let query = db.collection('stories')
    .where('isCommunityStory', '==', true)
    .where('status', 'in', ['under_review', 'failed'])
    .where('ttsEngine', '==', 'edge-tts');

  const filterId = (process.env.STORIES_FILTER || '').trim();
  if (filterId) {
    query = query.where('storyId', '==', filterId);
  }

  const snap = await query.get();
  if (snap.empty) {
    console.log('✅ No pending community stories to process.');
    process.exit(0);
  }

  console.log(`\n🎯 Found ${snap.size} pending community story(ies)\n`);

  const processed = [];

  for (const docSnap of snap.docs) {
    const story = docSnap.data();
    const storyId = docSnap.id;
    console.log(`  → ${story.title || 'untitled'} (${storyId})`);

    const coverPath = path.join(PUB, 'covers', `${storyId}.jpg`);
    const audioPath = path.join(PUB, 'audio', `${storyId}.mp3`);

    try {
      // 1. Generate cover image
      await fetchImage(
        `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt(story))}?width=768&height=768&nologo=true&seed=${hashSeed(storyId)}&model=flux`,
        coverPath
      );
      console.log(`    ✅ Cover: ${Math.round(fs.statSync(coverPath).size / 1024)}KB`);

      // 2. Generate audio
      // Creation-time language picker offers every LANGUAGES entry, so each one
      // needs a voice here — otherwise a Spanish story is read aloud by an
      // English voice, which mangles the pronunciation.
      const voice = VOICES[story.language] || VOICES.en;
      synth(story.text, voice, audioPath);
      const dur = durationSec(audioPath) || Math.max(30, Math.round((story.text || '').split(/\s+/).length / 2.5));
      console.log(`    ✅ Audio: ${Math.round(fs.statSync(audioPath).size / 1024)}KB, ${dur}s`);

      // 3. Render the shareable page.
      // Deployed together with the audio and cover below, so the link and the
      // assets it references go live in the same push.
      const { pageUrl } = writeStoryPage(PUB, {
        ...story,
        storyId,
        audioUrl: `${SITE}/audio/${storyId}.mp3`,
        coverImage: `${SITE}/covers/${storyId}.jpg`,
        duration: dur,
      }, { site: SITE });
      console.log(`    ✅ Page: ${pageUrl}`);

      // 4. Render Instagram carousel slides (cover + story-arc quote cards +
      // CTA). Written alongside the audio/cover so the single deploy below
      // carries them too; the actual IG post happens after publish.
      let igSlideUrls = [];
      let igHook = null;
      try {
        const built = await buildCarouselSlides({
          storyId, title: story.title, text: story.text, genre: story.genre, description: story.description,
          coverPath, outDir: path.join(PUB, 'instagram', storyId), siteUrl: SITE,
        });
        igSlideUrls = built.urls;
        igHook = built.hook;
        console.log(`    ✅ IG slides: ${igSlideUrls.length}`);
      } catch (e) {
        console.warn(`    ⚠️  Carousel render failed: ${e.message}`);
      }

      // 5. Deploy to Firebase Hosting
      // (deployed after all stories are processed)

      processed.push({
        id: storyId, title: story.title, authorName: story.authorName,
        authorId: story.authorId, genre: story.genre, duration: dur, pageUrl,
        text: story.text, description: story.description, igSlideUrls, igHook,
      });
    } catch (e) {
      console.error(`    ❌ Failed: ${e.message}`);
      // Mark as failed so it can be retried later
      await db.collection('stories').doc(storyId).update({
        status: 'failed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  if (processed.length === 0) {
    console.log('\n❌ No stories processed successfully.');
    process.exit(1);
  }

  // Deploy all generated files.
  //
  // A failed deploy must NOT publish: the audioUrl and coverImage below point at
  // files that only exist once hosting has them, so publishing anyway would put
  // a story with a dead audio URL into the feed and broadcast it to every user.
  // Leaving them 'failed' means the next run (hourly cron) retries the whole
  // thing, since the query matches 'failed' as well as 'under_review'.
  console.log(`\n🚀 Deploying ${processed.length} story asset(s) to Firebase Hosting...`);
  try {
    execFileSync('npx', ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
      { cwd: ROOT, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SA_PATH } });
    console.log('✅ Hosting deployed.');
  } catch (e) {
    console.error('❌ Hosting deploy failed:', e.message);
    console.error('   Not publishing — assets are not reachable. Marking for retry.');
    for (const item of processed) {
      await db.collection('stories').doc(item.id).update({
        status: 'failed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch((err) => console.warn(`  ⚠️  could not mark ${item.id} failed: ${err.message}`));
    }
    process.exit(1);
  }

  // Update Firestore: flip status → published, add audioUrl + coverImage
  for (const item of processed) {
    const audioUrl = `${SITE}/audio/${item.id}.mp3`;
    const coverUrl = `${SITE}/covers/${item.id}.jpg`;

    await db.collection('stories').doc(item.id).update({
      audioUrl,
      coverImage: coverUrl,
      // The page the share sheet hands out. Recorded only now, after the deploy
      // succeeded, so a shared link never points at a page that isn't up.
      pageUrl: item.pageUrl,
      duration: item.duration,
      status: 'published',
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✓ ${item.title} → published`);

    // Two notifications: the author, then everyone else. Guarded so a delivery
    // failure on one story can't abort the loop and strand the rest unpublished —
    // the story itself is already live by this point.
    try {
      await sendPublisherNotification({ ...item, coverImage: coverUrl, storyId: item.id });
      await sendBroadcastNotification({ ...item, coverImage: coverUrl, storyId: item.id });
    } catch (e) {
      console.warn(`  ⚠️  notifications for ${item.id} failed: ${e.message}`);
    }

    // Instagram + Facebook — best-effort, never blocks the story itself from
    // being published (see lib/instagram.js and lib/facebook.js for the
    // no-op-when-unconfigured behavior and INSTAGRAM-SETUP.md for setting up
    // the credentials).
    if (item.igSlideUrls?.length) {
      const socialStory = {
        title: item.title, text: item.text, description: item.igHook || item.description,
        genre: item.genre, pageUrl: item.pageUrl,
      };
      await postStoryCarousel(socialStory, item.igSlideUrls);
      await postStoryToFacebook(socialStory, item.igSlideUrls);
    }
  }

  console.log(`\n✅ Done. Published ${processed.length} community story(ies).`);
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
