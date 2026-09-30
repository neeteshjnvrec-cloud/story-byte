/**
 * StoryByte daily content pipeline (GitHub Actions or local).
 *
 * Generates one Hindi devotional story per day: the weekday deity's katha
 * (lib/devotional-calendar.js), or a devotional festival's story on those
 * days (occasions.js). Its opening minute is posted as a Short to YouTube,
 * Instagram and Facebook; the full narration goes to the app. Failed
 * stories are retried the next day.
 *
 * Daily stories only. Community stories are owned end-to-end by
 * generate-community-audio.js; this script used to generate their assets too but
 * never flipped their status to 'published', which left them fully generated and
 * permanently invisible.
 *
 * Env: GROQ_API_KEY (req), GROQ_MODEL, FIREBASE_SERVICE_ACCOUNT (JSON, CI) or a
 *      local functions/firebase-service-account.json, STORY_DATE (opt),
 *      MAX_FANOUT_USERS (opt, ceiling on notification recipients).
 */
const admin = require('firebase-admin');
const Groq = require('groq-sdk');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { notifyAndPushAll } = require('./lib/notify');
const { writeStoryPage } = require('./lib/story-page');
const { fetchStoryImage } = require('./lib/scene-image');
const { renderFallbackCover } = require('./lib/fallback-cover');
const { buildCarouselSlides } = require('./lib/carousel-slides');
const { buildStoryVideo } = require('./lib/video');
const { buildVideoScenes } = require('./lib/video-scenes');
const { parseSrt, toCaptionLines } = require('./lib/subtitles');
const { bakeInCaptions } = require('./lib/caption-frames');
const { REEL_MAX_SEC, SHORT_MAX_SEC, clipScenes, clipAudio, shortCutoff } = require('./lib/video-clip');
const { postStoryCarousel, postStoryReel, commentOnInstagram } = require('./lib/instagram');
const { postStoryToFacebook, postStoryVideo, commentOnFacebook } = require('./lib/facebook');
const { postStoryToYouTube, commentOnYouTube } = require('./lib/youtube');
const { getOccasion, occasionPhrase } = require('./occasions');
const { deityOfDay, GENERAL_HASHTAGS } = require('./lib/devotional-calendar');
const { styleOfDay } = require('./lib/short-style');
const { mixDevotionalMusic } = require('./lib/devotional-music');
const { synthSarvam } = require('./lib/sarvam-tts');
const { synth } = require('./lib/narrate');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'storybyte-76716';
const SITE = process.env.HOSTING_SITE || `https://${PROJECT}.web.app`;
// Model fallback chain (ordered by speed/reliability based on tests):
// 1. qwen/qwen3.6-27b — fastest (259ms), reliable
// 2. openai/gpt-oss-20b — good speed, cheap, occasionally empty (caught below)
// 3. groq/compound — slower (3s) but very reliable
// 4. openai/gpt-oss-120b — best quality but rate-limited on free tier
//
// GROQ_MODEL can be:
//   - comma-separated: "model1,model2,model3"
//   - JSON array string: '["model1","model2"]' or ["model1","model2"]
// --- .env loader (local) ---
(function () {
  try {
    const p = path.join(ROOT, '.env');
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) {}
})();

function parseModels(envValue) {
  if (!envValue) return ['groq/compound-mini', 'groq/compound', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
  const raw = envValue.trim();
  // Try JSON array first (handles ['model1', 'model2'] format)
  if (raw.startsWith('[') || raw.startsWith('(')) {
    try {
      const cleaned = raw.replace(/^\[|^\(|\]$|\)$/g, ''); // Remove brackets
      return cleaned.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } catch (e) {
      // Fall through to simple split
    }
  }
  // Simple comma-separated
  return raw.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}
const MODELS = parseModels(process.env.GROQ_MODEL);
const DATE = process.env.STORY_DATE || new Date().toISOString().slice(0, 10);
const DAILY_COUNT = 1; // Exactly 1 story per day
const MAX_RETRIES = 6; // Retry each slot up to 6 times (trying different models)

// --- credentials: resolve a service-account file path ---
function serviceAccountPath() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const p = path.join(os.tmpdir(), 'sb-sa.json');
    fs.writeFileSync(p, process.env.FIREBASE_SERVICE_ACCOUNT);
    return p;
  }
  const local = path.join(ROOT, 'functions/firebase-service-account.json');
  if (fs.existsSync(local)) return local;
  throw new Error('No Firebase credentials');
}
const SA_PATH = serviceAccountPath();
admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)) });
const db = admin.firestore();

// --- slots ---
const PROMPTS = {
  romance: 'Write a warm, engaging short romance with emotional depth and a satisfying ending.',
  mystery: 'Write a compelling short mystery with a clever, fair twist at the end.',
  adventure: 'Write a fun, wholesome adventure suitable for children aged 5-9, with a gentle lesson.',
  sleep: 'Write a calm, soothing bedtime story with soft imagery and a slow, relaxing pace.',
  drama: 'Write a heartfelt drama about family, love, or personal growth.',
  motivation: 'Write an inspiring motivational story about overcoming challenges and achieving success.',
  devotional: 'Write a touching devotional story with spiritual wisdom and moral values.',
};
// One Hindi devotional story a day, about the weekday's deity (see
// lib/devotional-calendar.js). This used to be a random pick from 12
// genre/language slots; across Instagram, Facebook and YouTube those drew
// 1-7 views/likes a post while the same accounts' devotional content drew
// 1K-41K (reports/social, Sept 2026).
// edge-tts fallback voice: Madhur, a male voice in the kathavachak
// tradition, slightly slowed for storytelling. SARVAM_API_KEY switches to
// Sarvam's far more natural Bulbul voices (lib/sarvam-tts.js).
const DAILY_SLOT = {
  language: 'hi', genre: 'devotional', vertical: 'hindi',
  voice: process.env.DEVOTIONAL_VOICE || 'hi-IN-MadhurNeural', rate: process.env.DEVOTIONAL_RATE || '-5%',
};
const SLOTS = [DAILY_SLOT];

const slug = (s) => (s || 'story').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
const hashSeed = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000; return h; };

async function getFailedSlots() {
  // Load failed slots for retry
  const snap = await db.collection('failed_slots').doc(DATE).get();
  if (snap.exists) return snap.data()?.slots || [];
  return [];
}

async function saveFailedSlots(slots) {
  await db.collection('failed_slots').doc(DATE).set({
    slots, date: DATE, updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function markSlotSuccess(slot) {
  const docRef = db.collection('failed_slots').doc(DATE);
  const doc = await docRef.get();
  if (doc.exists) {
    const slots = (doc.data()?.slots || []).filter(s => s.language !== slot.language || s.genre !== slot.genre);
    await docRef.set({ slots, date: DATE, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
}

async function generateText(groq, slot) {
  const langInstruction = slot.language === 'hi' ? 'Hindi (Devanagari).' : 'English.';
  // Compact system prompt to avoid "Request Entity Too Large" (413) errors
  const occasionInstruction = slot.occasion
    ? ` ${occasionPhrase(slot.occasion, DATE)} — write a story that genuinely centers this occasion ` +
      `(${slot.occasion.visual}), not a generic ${slot.genre} story with the festival mentioned in passing. ` +
      'Each day in this festival season should read as a different story, not a retelling of the same one.'
    : '';
  // A known katha, retold — the audience already loves these stories, so
  // the job is to tell them vividly and faithfully, not invent new ones.
  const kathaInstruction = slot.deity
    ? ` Retell this well-known katha of ${slot.deity.name} (${slot.deity.hindi}): "${slot.deity.katha}". Stay faithful ` +
      'to the traditional version from the Puranas / Ramayana / Mahabharata — no invented characters or modern ' +
      'settings — but tell it vividly, with emotion, dialogue and devotion.'
    : '';
  // The first minute becomes the YouTube Short / Reel, so it has to grip on
  // its own.
  const hookInstruction = slot.genre === 'devotional'
    ? ` The first two sentences must be a gripping hook — ${slot.look?.hook || 'the most astonishing moment or question of the story'} — ` +
      'because the first minute is posted on its own as a Short.'
    : '';
  const socialTitleSpec = slot.genre === 'devotional'
    ? ',"socialTitle":"Hindi curiosity hook for YouTube Shorts/Reels, max 70 chars, starting with one fitting emoji and ' +
      'naming the deity, e.g. \\"😱 जब बाल कृष्ण के मुँह में माँ यशोदा ने देखा पूरा ब्रह्मांड\\"",' +
      '"commentQuestion":"one warm Hindi question inviting viewers to reply in the comments about this katha, max 120 chars, ' +
      'ending with 🙏 — e.g. which moment moved them, or which katha they want next"'
    : '';
  const sys = `You are a storyteller for an audio app. ${PROMPTS[slot.genre] || PROMPTS.drama}${occasionInstruction}${kathaInstruction}${hookInstruction} Write in ${langInstruction} ` +
    `JSON only: {"title":"max 60 chars","description":"one sentence","text":"450-800 words, spoken style, no markdown","tags":["genre"]${socialTitleSpec}}.`;
  const userPrompt = slot.occasion ? `Write a story for ${slot.occasion.name}.`
    : slot.deity ? `Tell the katha: ${slot.deity.katha}.` : `Write a ${slot.genre} story.`;

  // Try each model in the fallback chain until one succeeds
  const errors = [];
  for (const model of MODELS) {
    try {
      const c = await groq.chat.completions.create({
        model, temperature: 0.85, max_tokens: 2048, top_p: 0.95,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userPrompt }],
      });
      const d = JSON.parse(c.choices[0].message.content.trim());
      if (!d.title || !d.text || d.text.trim().length < 50) throw new Error('incomplete/empty text');
      // Log which model succeeded (useful for debugging)
      console.log(`  ✅ Model: ${model}`);
      return {
        title: String(d.title).replace(/^["']|["']$/g, '').slice(0, 70),
        description: String(d.description || `A ${slot.genre} story`).slice(0, 160),
        text: String(d.text).trim(),
        tags: Array.isArray(d.tags) ? d.tags.slice(0, 6) : [slot.genre],
        socialTitle: d.socialTitle ? String(d.socialTitle).replace(/^["']|["']$/g, '').slice(0, 80) : null,
        commentQuestion: d.commentQuestion ? String(d.commentQuestion).trim().slice(0, 200) : null,
      };
    } catch (e) {
      errors.push({ model, error: e.message });
      console.log(`  ✗ ${model}: ${e.message.slice(0, 60)}`);
      // If it's a model not found / auth error, don't bother trying next
      if (e.message.includes('not found') || e.message.includes('authentication') || e.message.includes('Invalid API Key')) {
        throw new Error(`Model ${model} failed permanently: ${e.message}`);
      }
    }
  }
  // All models exhausted
  const modelSummaries = errors.map(e => `${e.model}(${e.error.slice(0, 30)})`).join(' | ');
  throw new Error(`All models failed: ${modelSummaries}`);
}

function coverPrompt(slotOrStory, content) {
  // Support both slot objects (daily) and story objects (community)
  const genre = slotOrStory.genre || content?.genre;
  const mood = (slotOrStory.isSleep || (content && content.isSleep)) ? 'calm dreamy nighttime, soft moonlight' :
    (slotOrStory.isKids || (content && content.isKids)) ? 'bright cheerful playful cartoon' :
    genre === 'mystery' ? 'moody atmospheric, muted tones' :
    genre === 'romance' ? 'warm golden tender' :
    genre === 'devotional' ? 'divine and serene, Indian mythology art style, temple and nature imagery, soft golden glow' :
    genre === 'motivation' ? 'bright, uplifting, golden hour light' :
    genre === 'adventure' ? 'sweeping, sunlit, epic vistas' :
    genre === 'drama' ? 'warm cinematic, earthy tones' : 'warm cinematic';
  // Devotional stories are often about a specific deity/figure named in the
  // title (e.g. "Krishna") — prefer that over the description, which is
  // often too abstract ("a story about faith and love") for the image model
  // to draw anything devotional-looking from.
  const subject = genre === 'devotional'
    ? (content?.title || slotOrStory.title || content?.description || slotOrStory.description || '')
    : (content?.description || content?.title || slotOrStory.description || slotOrStory.title || '');
  // An occasion-themed story gets its festival's own visual cues instead —
  // otherwise "warm golden tender" romance mood etc. has nothing to do with
  // the actual festival the story is about.
  const occasion = slotOrStory.occasion || content?.occasion;
  const deity = slotOrStory.deity;
  const finalSubject = occasion ? `${occasion.visual}, ${occasion.name} celebration`
    : deity ? `${deity.visual}, ${deity.katha}` : subject;
  return `${finalSubject}. Storybook cover illustration, ${mood}, painterly, cozy, high detail, no text, no words`;
}

function durationSec(file) {
  try { return Math.round(parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())) || 0; }
  catch (e) { return 0; }
}

async function createNotification(story) {
  // One doc per user under users/{uid}/notifications — the only path the app
  // reads. This previously wrote a single doc to a top-level `notifications`
  // collection that nothing subscribed to.
  await notifyAndPushAll(
    db,
    {
      type: 'new_story',
      title: `New ${story.genre} story`,
      body: story.title,
      storyId: story.storyId,
      genre: story.genre,
      coverImage: story.coverImage,
    },
    {
      title: `New ${story.genre} story`,
      body: story.title,
      data: { storyId: story.storyId, type: 'new_story', navigateTo: 'StoryDetail' },
    }
  );
}

// --- utils ---
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  fs.mkdirSync(path.join(PUB, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(PUB, 'covers'), { recursive: true });
  // Shareable story pages. Staged here with the other assets so the single
  // hosting deploy below picks them up.
  fs.mkdirSync(path.join(PUB, 's'), { recursive: true });
  if (!fs.existsSync(path.join(PUB, 'index.html'))) {
    fs.writeFileSync(path.join(PUB, 'index.html'), '<!doctype html><title>StoryByte CDN</title><h1>StoryByte content</h1>');
  }

  // Get today's failed slots for retry
  const failedSlots = await getFailedSlots();
  console.log(`\n📅 Today: ${DATE}`);
  console.log(`❌ Failed slots to retry: ${failedSlots.length}`);

  // Select slots: prioritize failed slots for retry, then random
  let available = [...SLOTS];

  // Filter out slots that already have stories today
  for (const slot of SLOTS) {
    const q = db.collection('stories')
      .where('generatedDate', '==', DATE)
      .where('language', '==', slot.language)
      .where('genre', '==', slot.genre)
      .limit(1);
    const snap = await q.get();
    if (!snap.empty) {
      available = available.filter(s => !(s.language === slot.language && s.genre === slot.genre));
    }
  }

  if (available.length === 0) {
    console.log(`✓ Today's story (${DATE}) already exists — nothing to do.`);
    process.exit(0);
  }

  // A devotional festival (occasions.js) takes the day; otherwise it's the
  // weekday's deity and this week's katha. Non-devotional occasions (e.g.
  // Gandhi Jayanti, Karva Chauth) no longer replace the devotional story.
  const occasion = getOccasion(DATE);
  const slot = occasion?.genre === 'devotional'
    ? { ...DAILY_SLOT, occasion }
    : { ...DAILY_SLOT, deity: deityOfDay(DATE) };
  // The day's look: camera moves, colour grade, captions, hook style, music.
  slot.look = styleOfDay(DATE);
  if (slot.occasion) console.log(`🎉 Today's occasion: ${occasion.name}`);
  else console.log(`🙏 Today's katha: ${slot.deity.name} — ${slot.deity.katha}`);
  const pendingSlots = [{ ...slot, retry: failedSlots.length > 0 }];

  console.log(`🎯 Selected ${pendingSlots.length} slots for today\n`);

  // Generate stories with dynamic replacement
  const pending = [];
  const failedToday = [];
  const usedSlots = new Set(); // Track which slots we've already tried today

  for (let i = 0; i < DAILY_COUNT; i++) {
    const slotInfo = pendingSlots[i];
    let generated = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && !generated) {
      attempts++;
      const slot = slotInfo.slot || slotInfo;
      const isRetry = slotInfo.retry || attempts > 1;

      // Check if we've already tried this exact slot today
      const slotKey = `${slot.language}_${slot.genre}`;
      if (usedSlots.has(slotKey) && !isRetry) {
        // Pick a different random slot from available
        const remaining = available.filter(s => !usedSlots.has(`${s.language}_${s.genre}`));
        if (remaining.length === 0) {
          console.log(`⚠️  No more available slots for attempt ${attempts}`);
          break;
        }
        const replacement = remaining[Math.floor(Math.random() * remaining.length)];
        console.log(`🔄 Swapping ${slot.language}/${slot.genre} → ${replacement.language}/${replacement.genre}`);
        Object.assign(slot, replacement);
      }

      console.log(`${isRetry ? '🔄 RETRY' : '🆕 NEW'} ${slot.language}/${slot.genre} (attempt ${attempts}/${maxAttempts})`);

      try {
        // Step 1: Generate text
        const content = await generateText(groq, slot);
        const id = `${DATE}_${slot.language}_${slot.genre}_${slug(content.title)}`;
        const existing = await db.collection('stories').doc(id).get();
        if (existing.exists && existing.data().audioUrl) {
          console.log('skip (exists):', id);
          generated = { id, slot, content, duration: existing.data().duration, skip: true };
          continue;
        }

        // Step 2: Generate cover — pollinations.ai, falling back to
        // Cloudflare Workers AI (see lib/scene-image.js), falling back to
        // a local themed gradient card (no network call, can't fail) if
        // both providers are down. Confirmed in production that a
        // pollinations-only outage previously aborted the whole story here
        // even though the actual text/audio content was generating fine.
        const cover = path.join(PUB, 'covers', `${id}.jpg`);
        let coverBuf;
        try {
          coverBuf = await fetchStoryImage(coverPrompt(slot, content), hashSeed(id), { width: 768, height: 768 });
        } catch (e) {
          console.warn(`  ⚠️  Cover fetch failed for ${id}, using a themed fallback: ${e.message}`);
          coverBuf = await renderFallbackCover(slot.genre);
        }
        fs.writeFileSync(cover, coverBuf);

        // Step 3: Generate audio
        const audio = path.join(PUB, 'audio', `${id}.mp3`);
        const subsPath = path.join(os.tmpdir(), `${id}.srt`);
        const synthResult = (slot.genre === 'devotional' &&
            await synthSarvam(content.text, { out: audio, subsOut: subsPath, language: slot.language })) ||
          synth(content.text, slot, audio, subsPath);
        const dur = durationSec(audio) || Math.max(60, Math.round(content.text.split(/\s+/).length / 2.5));

        console.log(`✅ generated ${id} (${dur}s)`);

        // Step 4: Render Instagram carousel slides (cover + story-arc quote
        // cards + CTA). Written alongside the audio/cover so the single
        // deploy below carries them too; the actual IG post happens after
        // the story is written to Firestore as published.
        let igSlideUrls = [];
        let igHook = null;
        let igPlainSceneFiles = [];
        const outDir = path.join(PUB, 'instagram', id);
        try {
          const built = await buildCarouselSlides({
            storyId: id, title: content.title, text: content.text, genre: slot.genre, description: content.description,
            coverPath: cover, outDir, siteUrl: SITE,
          });
          igSlideUrls = built.urls;
          igHook = built.hook;
          igPlainSceneFiles = built.plainSceneFiles;
        } catch (e) {
          console.warn(`  ⚠️  Carousel render failed for ${id}: ${e.message}`);
        }

        // Step 5: Render the narrated video (real story-content scenes,
        // timed to the actual narration, + burned-in captions) for a Reel/
        // video post — the only way the narration plays (with captions) on
        // Instagram/Facebook, since the carousel above is silent and static.
        let videoUrl = null;
        let reelVideoUrl = null;
        let shortPath = null;
        if (igSlideUrls.length) {
          try {
            // Real-content, narration-timed scenes (lib/video-scenes.js) —
            // walks the actual story with art that tracks what's being
            // said, not the carousel's spoiler-free teaser slides at equal
            // intervals. Falls back to the carousel's own PLAIN backgrounds
            // (no wordmark/page-counter/teaser text — see plainSceneFiles in
            // lib/carousel-slides.js) at even timing if Groq/subtitles
            // aren't available, so the video post is never blocked by this
            // — and never shows carousel UI baked into a video frame.
            let scenes = null;
            let cues = null;
            if (synthResult.subtitlesPath) {
              try {
                const parsed = parseSrt(fs.readFileSync(synthResult.subtitlesPath, 'utf8'));
                if (parsed.length) cues = parsed;
              } catch (e) {
                console.warn(`  ⚠️  Subtitle parsing failed for ${id}: ${e.message}`);
              }
            }
            // A devotional story only becomes its first-minute Short, so only
            // that minute is illustrated — 8 pictures, a new one every ~7s.
            const shortSec = slot.genre === 'devotional' ? Math.min(dur, shortCutoff(cues, SHORT_MAX_SEC)) : null;
            if (cues) {
              try {
                const sceneCues = shortSec ? cues.filter((c) => c.start < shortSec) : cues;
                scenes = await buildVideoScenes({
                  storyId: id, title: content.title, genre: slot.genre, description: content.description,
                  text: shortSec ? sceneCues.map((c) => c.text).join(' ') : content.text,
                  cues: sceneCues, audioDurSec: shortSec || dur, outDir,
                });
              } catch (e) {
                console.warn(`  ⚠️  Narration-synced scenes failed for ${id}, using plain backgrounds: ${e.message}`);
              }
            }
            if (!scenes) {
              scenes = igPlainSceneFiles.map((file) => ({ file }));
            }
            // clipScenes below needs a real per-scene duration regardless of
            // which path produced `scenes` — the plain-background fallback
            // has none (buildStoryVideo splits the audio evenly on its own),
            // so backfill the same even split explicitly here. Must happen
            // before bakeInCaptions, which needs every scene's duration to
            // know which background is on screen at a given caption's time.
            if (scenes.some((s) => !s.duration)) {
              const per = Math.max(2, dur / scenes.length);
              scenes = scenes.map((s) => ({ file: s.file, duration: s.duration || per }));
            }
            if (slot.genre === 'devotional') {
              // The devotional story's opening minute, cut on a sentence end,
              // is the Short posted to YouTube, Instagram and Facebook — full-
              // screen 9:16 in the day's look, over a soft devotional music
              // bed. Only that minute is rendered: the full narration lives
              // in the app (whose mp3 stays plain narration), and nothing
              // posts a full-length video for these stories.
              const look = slot.look;
              const clipSec = shortSec;
              const mixed = mixDevotionalMusic(audio, path.join(outDir, 'video-audio.mp3'), { variant: look.seed }) || audio;
              const shortAudio = clipAudio(mixed, clipSec, path.join(outDir, 'reel-audio.mp3'), { fadeOutSec: 1.2 });
              // The full-length mix is only an intermediate — don't let the
              // daily commit of public/instagram carry it.
              if (mixed !== audio) fs.rmSync(mixed, { force: true });
              let shortScenes = clipScenes(scenes, clipSec);
              if (cues) {
                const lines = toCaptionLines(cues).filter((l) => l.start < clipSec);
                shortScenes = await bakeInCaptions(shortScenes, lines, outDir, clipSec, { format: 'short', look });
              }
              const reelPath = shortAudio &&
                buildStoryVideo({ scenes: shortScenes, audioPath: shortAudio, outPath: path.join(outDir, 'story-reel.mp4'), format: 'short', look });
              if (reelPath) {
                reelVideoUrl = `${SITE}/instagram/${id}/story-reel.mp4`;
                shortPath = reelPath;
              }
            } else {
              // Captions track the real narration regardless of which path
              // produced the backgrounds above — skipping this on the plain-
              // background fallback previously meant a fallback video played
              // the full narration with no on-screen text at all past
              // whatever the first background happened to be.
              if (cues) {
                const captionLines = toCaptionLines(cues);
                scenes = await bakeInCaptions(scenes, captionLines, outDir, dur);
              }
              const videoPath = buildStoryVideo({ scenes, audioPath: audio, outPath: path.join(outDir, 'story.mp4') });
              if (videoPath) videoUrl = `${SITE}/instagram/${id}/story.mp4`;
              reelVideoUrl = videoUrl;

              // Instagram Reels only reliably process clips up to ~90s — a
              // long narration that publishes fine as a Facebook video
              // consistently fails Reels' async processing if sent in full.
              // Facebook keeps the full-length video; Instagram gets a short
              // clipped one instead.
              if (videoPath && dur > REEL_MAX_SEC) {
                try {
                  const clippedAudio = clipAudio(audio, REEL_MAX_SEC, path.join(outDir, 'reel-audio.mp3'));
                  if (clippedAudio) {
                    const clippedScenes = clipScenes(scenes, REEL_MAX_SEC);
                    const reelPath = buildStoryVideo({ scenes: clippedScenes, audioPath: clippedAudio, outPath: path.join(outDir, 'story-reel.mp4') });
                    if (reelPath) reelVideoUrl = `${SITE}/instagram/${id}/story-reel.mp4`;
                  }
                } catch (e) {
                  console.warn(`  ⚠️  Reel clip failed for ${id}, Instagram will use the full video: ${e.message}`);
                }
              }
            }
          } catch (e) {
            console.warn(`  ⚠️  Video render failed for ${id}: ${e.message}`);
          }
        }

        generated = { id, slot, content, duration: dur, igSlideUrls, igHook, videoUrl, reelVideoUrl, shortPath };
        await markSlotSuccess(slot);
        usedSlots.add(slotKey);
      } catch (e) {
        console.error(`✗ attempt ${attempts}:`, e.message);
        // Exponential backoff: 2s, 4s, 8s — avoids rate limits (429)
        if (attempts < maxAttempts) {
          const waitMs = Math.min(2000 * Math.pow(2, attempts - 1), 10000);
          console.log(`  ⏳ Waiting ${waitMs/1000}s before retry...`);
          await sleep(waitMs);
        }
        if (attempts >= maxAttempts) {
          failedToday.push({ language: slot.language, genre: slot.genre });
        }
      }
    }

    if (generated && !generated.skip) {
      pending.push(generated);
    } else if (!generated) {
      // Slot failed completely, pick a replacement for next iteration
      const remaining = available.filter(s => !usedSlots.has(`${s.language}_${s.genre}`));
      if (remaining.length > 0 && pending.length < DAILY_COUNT) {
        const replacement = remaining[Math.floor(Math.random() * remaining.length)];
        console.log(`🔀 Adding replacement: ${replacement.language}/${replacement.genre}`);
        pendingSlots.push({ ...replacement, retry: false });
      }
    }
  }

  // Save failed slots for retry tomorrow
  if (failedToday.length > 0) {
    await saveFailedSlots(failedToday);
    console.log(`\n⚠️  ${failedToday.length} slots failed — will retry tomorrow`);
  }

  // Community stories are NOT handled here — generate-community-audio.js owns
  // their whole lifecycle, including the status flip to 'published' and the
  // author/broadcast notifications. This script used to generate their assets in
  // parallel without flipping status, which stranded them as invisible.

  if (pending.length === 0) {
    console.log('❌ No stories to deploy.');
    process.exit(0);
  }

  // Render each story's shareable page. Done before the deploy so the page ships
  // in the same push as its audio and cover — a page that referenced assets not
  // yet uploaded would render broken for anyone who opened the link early.
  for (const p of pending) {
    const { pageUrl } = writeStoryPage(PUB, {
      storyId: p.id,
      title: p.content.title,
      description: p.content.description,
      text: p.content.text,
      genre: p.slot.genre,
      language: p.slot.language,
      duration: p.duration,
      author: 'StoryByte AI',
      audioUrl: `${SITE}/audio/${p.id}.mp3`,
      coverImage: `${SITE}/covers/${p.id}.jpg`,
    }, { site: SITE });
    p.pageUrl = pageUrl;
    console.log('✓ page', pageUrl);
  }

  // Deploy all staged files to Firebase Hosting once
  console.log(`\n🚀 Deploying ${pending.length} daily story(ies) to Firebase Hosting...`);
  execFileSync('npx', ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SA_PATH } });

  // Write daily story docs to Firestore
  for (const p of pending) {
    const storyData = {
      storyId: p.id, title: p.content.title, description: p.content.description,
      genre: p.slot.genre, language: p.slot.language, verticalId: p.slot.vertical,
      isKids: !!p.slot.isKids, isSleep: !!p.slot.isSleep, episode: 1,
      text: p.content.text,
      audioUrl: `${SITE}/audio/${p.id}.mp3`, coverImage: `${SITE}/covers/${p.id}.jpg`,
      // The page the share sheet hands out. Written only now, after the deploy
      // succeeded, so a shared link never points at a page that isn't up.
      pageUrl: p.pageUrl,
      duration: p.duration, isPremium: false, isDaily: true,
      // One lifecycle shared with community stories: 'published' means visible,
      // and isCommunityStory is the only thing that decides which feed.
      status: 'published', isCommunityStory: false,
      // Every aggregate present from birth so the metrics store never has to
      // fall back for a fresh story.
      plays: 0, likesCount: 0, rating: 0, ratingSum: 0, ratingCount: 0, sharesCount: 0,
      generatedDate: DATE, voice: p.slot.voice, ttsEngine: 'edge-tts', author: 'StoryByte AI',
      tags: p.slot.occasion ? [...p.content.tags, p.slot.occasion.name] : p.content.tags,
      occasion: p.slot.occasion?.name || null,
      // What the social posts were titled, so reports/social can tie each
      // YouTube/Instagram/Facebook post back to its story.
      socialTitle: p.content.socialTitle || null,
      deity: p.slot.deity?.key || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('stories').doc(p.id).set(storyData, { merge: true });
    console.log('✓ daily doc', p.id);
    await createNotification({
      storyId: p.id, title: p.content.title, genre: p.slot.genre,
      coverImage: `${SITE}/covers/${p.id}.jpg`,
    });

    // Instagram + Facebook — best-effort, never blocks the daily batch (see
    // lib/instagram.js and lib/facebook.js: both no-op until their secrets
    // are configured; see INSTAGRAM-SETUP.md to set those up).
    if (p.igSlideUrls?.length) {
      // Devotional stories post as Shorts everywhere, under the Hindi hook
      // title and deity hashtags that the channel's best Shorts use.
      const devotional = p.slot.genre === 'devotional';
      const deityTags = p.slot.deity?.hashtags || [];
      const socialStory = {
        title: (devotional && p.content.socialTitle) || p.content.title,
        text: p.content.text, description: p.igHook || p.content.description,
        genre: p.slot.genre, pageUrl: p.pageUrl, occasionHashtag: p.slot.occasion?.hashtag,
        hashtags: devotional ? [...new Set([...deityTags, ...GENERAL_HASHTAGS, p.slot.occasion?.hashtag].filter(Boolean))] : null,
        isShort: devotional,
        tagWords: devotional ? [p.slot.deity?.name, 'bhakti', 'hindi story', 'katha', p.slot.occasion?.name].filter(Boolean) : null,
      };

      // Prefer the narrated video — it carries the audio, the carousel
      // doesn't — and only fall back to the silent carousel/photo post if
      // the video post itself fails, so a story never posts twice.
      // Instagram always gets the short clip (reelVideoUrl falls back to
      // the full video when no clipping was needed). Devotional stories send
      // that same under-a-minute Short to Facebook and YouTube too; the full
      // narration is in the app, linked from every post.
      const igReel = p.reelVideoUrl ? await postStoryReel(socialStory, p.reelVideoUrl) : { posted: false };
      if (!igReel.posted) await postStoryCarousel(socialStory, p.igSlideUrls);

      const fbVideoUrl = devotional ? p.reelVideoUrl : p.videoUrl;
      const fbVideo = fbVideoUrl ? await postStoryVideo(socialStory, fbVideoUrl) : { posted: false };
      if (!fbVideo.posted) await postStoryToFacebook(socialStory, p.igSlideUrls);

      // Independent of whether IG/FB succeeded, so one platform's failure
      // never costs another. Reads straight off local disk, so it doesn't
      // need the Firebase Hosting deploy above to have happened first.
      const ytVideo = devotional ? p.shortPath : (p.videoUrl && path.join(PUB, 'instagram', p.id, 'story.mp4'));
      const ytPost = ytVideo ? await postStoryToYouTube(socialStory, ytVideo) : { posted: false };

      // A question as the first comment on each Short, to start the replies
      // Shorts/Reels ranking weighs heavily. Each needs its own permission
      // (see the setup docs) and just logs when it's missing. None of the
      // APIs can pin a comment — pin it by hand if wanted.
      if (devotional) {
        const deityName = p.slot.deity?.hindi || p.slot.occasion?.name || 'भगवान';
        const question = p.content.commentQuestion || `🙏 ${deityName} की कौन सी कथा आप अगली बार सुनना चाहेंगे? कमेंट में लिखिए 🙏`;
        if (ytPost.posted) await commentOnYouTube(ytPost.videoId, question);
        if (fbVideo.posted && fbVideo.videoId) await commentOnFacebook(fbVideo.videoId, question);
        if (igReel.posted && igReel.mediaId) await commentOnInstagram(igReel.mediaId, question);
      }
    }
  }

  // Log generation
  await db.collection('generation_logs').doc(DATE).set({
    date: DATE, count: pending.length, expected: DAILY_COUNT, failed: failedToday.length,
    at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(`\n✅ Done. Published ${pending.length}/${DAILY_COUNT} stories for ${DATE}.`);
  process.exit(0);
}

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
