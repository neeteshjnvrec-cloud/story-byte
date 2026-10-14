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
const { extractJson } = require('./lib/carousel-copy');
const { buildStoryVideo } = require('./lib/video');
const { buildVideoScenes } = require('./lib/video-scenes');
const { parseSrt, toCaptionLines } = require('./lib/subtitles');
const { bakeInCaptions } = require('./lib/caption-frames');
const { REEL_MAX_SEC, clipScenes, clipAudio } = require('./lib/video-clip');
const { postStoryCarousel, postStoryReel, commentOnInstagram } = require('./lib/instagram');
const { postStoryToFacebook, postStoryVideo, commentOnFacebook } = require('./lib/facebook');
const { postStoryToTelegram } = require('./lib/telegram');
const { postStoryToYouTube, commentOnYouTube } = require('./lib/youtube');
const { occasionPhrase } = require('./occasions');
const { kathaOfDay, nextKatha, describeKatha, GENERAL_HASHTAGS } = require('./lib/devotional-calendar');
const { appendSpokenTeaser, fallbackTeaser, endingCandidates } = require('./lib/teaser');
const { withCloseUps, shortSceneCount } = require('./lib/close-ups');
const { devotionalTrends } = require('./lib/trends');
const { iconographyFor } = require('./lib/iconography');
const { styleOfDay, fitShort, devotionalArtStyle } = require('./lib/short-style');
const { mixDevotionalMusic } = require('./lib/devotional-music');
const { synthSarvam } = require('./lib/sarvam-tts');
const { synth } = require('./lib/narrate');
const { synthBackup } = require('./lib/backup-voice');
const { mediaKey } = require('./lib/media-key');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'storybyte-76716';
const SITE = process.env.HOSTING_SITE || `https://${PROJECT}.web.app`;
// Model fallback chain (Groq's production models as of Oct 2026; qwen3.6
// and groq/compound were retired on 2026-10-01 and took a day's story down):
// 1. openai/gpt-oss-120b — best writing quality (reasoning model)
// 2. openai/gpt-oss-20b — faster, same JSON handling
// 3. llama-3.3-70b-versatile — non-reasoning; once 404'd for this account,
//    so it sits after the gpt-oss pair where a 404 just costs one call
// 4. qwen/qwen3.8-27b — preview, may be retired at short notice
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
  if (!envValue) return ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'qwen/qwen3.8-27b'];
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

/** `text` cut to at most `max` characters at a word boundary. */
function capAtWord(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), Math.floor(max * 0.6))).trim();
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
  // The whole katha is the Short, so it has to grip from the first line and
  // be complete — a real run posted only its first minute, cut off mid-story.
  const hookInstruction = slot.genre === 'devotional'
    ? ` The first two sentences must be a gripping hook — ${slot.look?.hook || 'the most astonishing moment or question of the story'} — ` +
      'because the first seconds decide whether a Shorts viewer keeps watching.'
    : '';
  const socialTitleSpec = slot.genre === 'devotional'
    ? ',"socialTitle":"Hindi curiosity hook for YouTube Shorts/Reels, at most 60 characters: one fitting emoji, then the ' +
      'deity\'s name first (the word people search), then the hook, e.g. \\"😱 बाल कृष्ण के मुँह में यशोदा ने देखा ब्रह्मांड\\"",' +
      '"commentQuestion":"one warm Hindi question inviting viewers to reply in the comments about this katha, max 120 chars, ' +
      'ending with 🙏 — e.g. which moment moved them, or which katha they want next",' +
      '"searchTags":["8-12 short YouTube search tags for this katha, Hindi and Hinglish, e.g. the deity\'s name + कथा"]' +
      (slot.next ? `,"nextTeaser":"one Hindi line, max 90 chars, starting with कल सुनिए, that makes viewers want to come back ` +
        `tomorrow for the next katha — ${describeKatha(slot.next).replace(/"/g, "'")} — a curiosity hook, no spoilers"` : '')
    : '';
  // Devotional: the complete katha is the ~2.5-minute Short, so it's
  // shorter than other stories — and must actually finish.
  // 280-340 Hindi words narrates in ~2.2-2.6 minutes — inside the 3-minute
  // Shorts limit with room to spare (see lib/short-style.js fitShort);
  // slot.maxWords tightens it for the one retry when a story runs long.
  const words = slot.maxWords ? `${slot.maxWords - 40}-${slot.maxWords}` : '280-340';
  const textSpec = slot.genre === 'devotional'
    ? `${words} words, spoken style, no markdown — the COMPLETE katha with a clear beginning, middle and ending: tell ` +
      'the resolution fully, then close with one line of blessing or its lesson. Never stop mid-story'
    : '450-800 words, spoken style, no markdown';
  // Viewers' own search words in the title/description/tags is how a new
  // Short gets found beyond the subscriber feed.
  const searches = slot.trends?.searches || [];
  const trending = slot.trends?.trending || [];
  const trendInstruction = slot.genre === 'devotional' && (searches.length || trending.length)
    ? (searches.length ? ` Right now people in India are searching YouTube for: ${searches.map((q) => `"${q}"`).join(', ')}. ` +
        'Use the one or two of these exact phrases that truly describe this katha naturally in socialTitle and description, ' +
        'so the video is found in search, and draw searchTags from them — never phrases about songs, aarti, drawings or photos it is ' +
        'not, and never other singers\', channels\' or regions\' names.' : '') +
      (trending.length ? ` Trending in India today: ${trending.join(', ')} — if one genuinely connects to this katha, ` +
        'reference it in the description.' : '')
    : '';
  const sys = `You are a storyteller for an audio app. ${PROMPTS[slot.genre] || PROMPTS.drama}${occasionInstruction}${kathaInstruction}${hookInstruction}${trendInstruction} Write in ${langInstruction} ` +
    `JSON only: {"title":"max 60 chars","description":"one sentence","text":"${textSpec}","tags":["genre"]${socialTitleSpec}}.`;
  const userPrompt = slot.occasion ? `Write a story for ${slot.occasion.name}.`
    : slot.deity ? `Tell the katha: ${slot.deity.katha}.` : `Write a ${slot.genre} story.`;

  // Try each model in the fallback chain until one succeeds. The token
  // budget leaves room for reasoning models (gpt-oss), which think before
  // answering, while staying under the free tier's 8K tokens-per-minute
  // cap (prompt + max_tokens counts against it): at 2048, a Hindi story plus that thinking got cut off
  // mid-JSON and Groq rejected it ("Failed to validate JSON") — on the day
  // the first model in the chain was retired, that failed the whole story.
  // A JSON-validation failure gets one more try on the same model without
  // strict JSON mode, with the object pulled out of the reply.
  const errors = [];
  const ask = (model, strict) => groq.chat.completions.create({
    model, temperature: 0.85, max_tokens: 6500, top_p: 0.95,
    ...(strict ? { response_format: { type: 'json_object' } } : {}),
    messages: [{ role: 'system', content: sys }, { role: 'user', content: userPrompt }],
  });
  for (const model of MODELS) {
    for (const strict of [true, false]) {
      try {
        const c = await ask(model, strict);
        const d = extractJson(c.choices[0].message.content || '');
        if (!d.title || !d.text || d.text.trim().length < 50) throw new Error('incomplete/empty text');
        // Log which model succeeded (useful for debugging)
        console.log(`  ✅ Model: ${model}${strict ? '' : ' (relaxed JSON)'}`);
        return {
          title: String(d.title).replace(/^["']|["']$/g, '').slice(0, 70),
          description: String(d.description || `A ${slot.genre} story`).slice(0, 160),
          text: String(d.text).trim(),
          tags: Array.isArray(d.tags) ? d.tags.slice(0, 6) : [slot.genre],
          socialTitle: d.socialTitle ? capAtWord(String(d.socialTitle).replace(/^["']|["']$/g, '').trim(), 70) : null,
          nextTeaser: d.nextTeaser ? capAtWord(String(d.nextTeaser).replace(/^["']|["']$/g, '').trim(), 120) : null,
          commentQuestion: d.commentQuestion ? String(d.commentQuestion).trim().slice(0, 200) : null,
        searchTags: Array.isArray(d.searchTags) ? d.searchTags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12) : [],
        };
      } catch (e) {
        errors.push({ model, error: e.message });
        console.log(`  ✗ ${model}${strict ? '' : ' (relaxed)'}: ${e.message.slice(0, 80)}`);
        // A bad key fails every model the same way — stop early. A retired
        // model (404) just moves on to the next one.
        if (e.message.includes('authentication') || e.message.includes('Invalid API Key')) {
          throw new Error(`Model ${model} failed permanently: ${e.message}`);
        }
        if (!strict || !/json_validate_failed|Failed to (validate|generate) JSON|no JSON|Unexpected token|JSON/i.test(e.message)) break;
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
  // A Navratri day has both — its own goddess is the better picture.
  // A deity's traditional look (lib/iconography.js), so the cover shows the
  // Hanuman or Ganesha devotees recognise, not the model's own invention.
  const looks = deity ? iconographyFor(`${deity.name} ${deity.katha}`, { context: deity.katha, max: 2 }).map((f) => f.look).join('. ') : '';
  const finalSubject = deity ? `${deity.katha}. ${looks || deity.visual}`
    : occasion ? `${occasion.visual}, ${occasion.name} celebration` : subject;
  // A devotional cover matches its video's art style (DEVOTIONAL_STYLE).
  if (genre === 'devotional') return `${finalSubject}. ${mood}, ${devotionalArtStyle()}`;
  return `${finalSubject}. Storybook cover illustration, ${mood}, painterly, cozy, high detail, no text, no words`;
}

function exactDuration(file) {
  try { return parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim()) || 0; }
  catch (e) { return 0; }
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

  // During Navratri each day is that day's form of Durga (what everyone is
  // searching for that day); otherwise a devotional festival (occasions.js)
  // takes the day, or else it's the weekday's deity and this week's katha.
  // Non-devotional occasions (e.g. Gandhi Jayanti, Karva Chauth) no longer
  // replace the devotional story.
  const slot = { ...DAILY_SLOT, ...kathaOfDay(DATE) };
  const occasion = slot.occasion;
  // Tomorrow's katha, teased at the end of today's Short (lib/teaser.js).
  slot.next = nextKatha(DATE);
  // The day's look: camera moves, colour grade, captions, hook style, music.
  slot.look = styleOfDay(DATE);
  if (slot.deity) console.log(`🙏 Today's katha: ${slot.deity.name} — ${slot.deity.katha}`);
  if (slot.occasion) console.log(`🎉 Today's occasion: ${occasion.name}`);
  console.log(`🔔 Tomorrow: ${describeKatha(slot.next)}`);
  // What India is searching for about today's deity/festival right now, so
  // the title, hook and tags use viewers' own words (lib/trends.js).
  // Hindi seeds only: an English deity name autocompletes to unrelated
  // creators' channel names ("shivani kumari official").
  slot.trends = await devotionalTrends([
    slot.deity && `${slot.deity.hindi} की कथा`, slot.deity?.hindi, slot.occasion?.name,
  ]);
  console.log(`📈 Searches: ${slot.trends.searches.join(' | ') || 'none'}`);
  if (slot.trends.trending.length) console.log(`📈 Trending today: ${slot.trends.trending.join(' | ')}`);
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
        let content = await generateText(groq, slot);
        if (slot.next && !content.nextTeaser) content.nextTeaser = fallbackTeaser(slot.next);
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
        // Sarvam (premium, if a key is set) > Microsoft's free edge-tts voice
        // (with retries) > the backup voices, Gemini then Google Cloud TTS,
        // for when Microsoft refuses for hours (lib/backup-voice.js).
        const narrateText = async (text, out, subsOut) => {
          if (slot.genre === 'devotional') {
            const premium = await synthSarvam(text, { out, subsOut, language: slot.language });
            if (premium) return premium;
          }
          try {
            return synth(text, slot, out, subsOut);
          } catch (e) {
            console.warn(`  ⚠️  ${e.message.split('\n')[0].slice(0, 160)} — trying the backup voices`);
            const backup = await synthBackup(text, { out, subsOut, edgeVoice: slot.voice });
            if (backup) return backup;
            throw e;
          }
        };
        const narrate = () => narrateText(content.text, audio, subsPath);
        let synthResult = await narrate();
        // A devotional katha too long to fit a Short even sped up is
        // rewritten shorter once — a 3:01 upload is filed as a regular
        // video and gets a fraction of a Short's views. Same katha and
        // title; only the text changes.
        if (slot.genre === 'devotional' && !fitShort(exactDuration(audio)).fits) {
          console.log(`  ✂️  ${Math.round(exactDuration(audio))}s is too long for a Short — rewriting it shorter`);
          try {
            const shorter = await generateText(groq, { ...slot, maxWords: 260 });
            content = { ...content, text: shorter.text };
            synthResult = await narrate();
          } catch (e) {
            console.warn(`  ⚠️  Shorter rewrite failed, keeping the original: ${e.message}`);
          }
        }
        const dur = durationSec(audio) || Math.max(60, Math.round(content.text.split(/\s+/).length / 2.5));

        console.log(`✅ generated ${id} (${dur}s)`);

        // Step 4: Render Instagram carousel slides (cover + story-arc quote
        // cards + CTA). Written alongside the audio/cover so the single
        // deploy below carries them too; the actual IG post happens after
        // the story is written to Firestore as published.
        let igSlideUrls = [];
        let igHook = null;
        let igPlainSceneFiles = [];
        // ASCII-only folder: Instagram can't fetch media from a Devanagari path.
        const media = mediaKey(id);
        const outDir = path.join(PUB, 'instagram', media);
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
        let videoSec = 0;
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
            // A devotional story's video is the whole katha. One that runs a
            // little over the Shorts limit is sped up slightly (pitch kept) —
            // so its captions and scenes are timed on that faster clock.
            const devotional = slot.genre === 'devotional';
            // The video's narration: the katha, then (devotional) tomorrow's
            // teaser and where to find the app, in the same voice. If that
            // would push it past the Shorts limit, the teaser alone, and
            // failing that the katha alone.
            let narration = audio;
            const teaserDir = devotional ? fs.mkdtempSync(path.join(os.tmpdir(), 'sb-teaser-')) : null;
            if (devotional && cues) {
              for (const ending of endingCandidates(content.nextTeaser)) {
                const withTeaser = await appendSpokenTeaser({ audio, cues, teaser: ending, narrate: narrateText, workDir: teaserDir });
                if (withTeaser && fitShort(exactDuration(withTeaser.audioPath)).fits) {
                  narration = withTeaser.audioPath;
                  cues = withTeaser.cues;
                  console.log(`  🔔 Ending: ${ending}`);
                  break;
                }
              }
            }
            // Exact length (durationSec rounds to whole seconds) so the video
            // timeline lands on the audio's real end.
            const exactDur = exactDuration(narration) || dur;
            const { tempo, tailSec } = devotional ? fitShort(exactDur) : { tempo: 1, tailSec: 0 };
            const videoDur = exactDur / tempo;
            if (cues && tempo !== 1) cues = cues.map((c) => ({ ...c, start: c.start / tempo, end: c.end / tempo }));
            // Devotional scene art and caption frames are render inputs only
            // (~25MB a day of 1080x1920 frames) — keep them out of the
            // public/instagram folder the daily commit carries.
            const workDir = devotional ? fs.mkdtempSync(path.join(os.tmpdir(), 'sb-short-')) : outDir;
            if (cues) {
              try {
                scenes = await buildVideoScenes({
                  storyId: id, title: content.title, text: content.text, genre: slot.genre,
                  description: content.description, cues, audioDurSec: videoDur, outDir: workDir,
                  // A new picture about every 8s, each also cut into a
                  // close-up below, so the view changes every ~4s.
                  sceneCount: devotional ? shortSceneCount(videoDur) : undefined,
                  // Which katha this is — e.g. Govardhan means Krishna is drawn as a child.
                  context: [slot.deity?.katha, slot.occasion?.name].filter(Boolean).join(' '),
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
              const per = Math.max(2, videoDur / scenes.length);
              scenes = scenes.map((s) => ({ file: s.file, duration: s.duration || per }));
            }
            if (devotional) {
              // The whole katha, full-screen 9:16 in the day's look, over a
              // soft devotional music bed that carries on for a moment after
              // the last word and fades — posted to YouTube (as a Short when
              // it fits), Instagram and Facebook. The app's own mp3 stays
              // plain narration.
              const look = slot.look;
              const mixed = mixDevotionalMusic(narration, path.join(outDir, 'video-audio.mp3'),
                { variant: look.seed, tempo, tailSec });
              const total = videoDur + tailSec;
              // The last picture holds through the music's closing seconds.
              scenes[scenes.length - 1] = { ...scenes[scenes.length - 1], duration: scenes[scenes.length - 1].duration + tailSec };
              // Each picture as a wide shot, then a close-up of part of it
              // (lib/close-ups.js), before the captions are drawn on.
              scenes = await withCloseUps(scenes, { outDir: workDir });
              if (cues) scenes = await bakeInCaptions(scenes, toCaptionLines(cues), workDir, total, { format: 'short', look });
              const videoPath = mixed &&
                buildStoryVideo({ scenes, audioPath: mixed, outPath: path.join(outDir, 'story.mp4'), format: 'short', look });
              // Intermediates — don't let the daily commit carry them.
              if (mixed) fs.rmSync(mixed, { force: true });
              fs.rmSync(workDir, { recursive: true, force: true });
              fs.rmSync(teaserDir, { recursive: true, force: true });
              if (videoPath) {
                videoUrl = `${SITE}/instagram/${media}/story.mp4`;
                reelVideoUrl = videoUrl;
                shortPath = videoPath;
                videoSec = durationSec(videoPath);
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
              if (videoPath) videoUrl = `${SITE}/instagram/${media}/story.mp4`;
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
                    if (reelPath) reelVideoUrl = `${SITE}/instagram/${media}/story-reel.mp4`;
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

        generated = { id, slot, content, duration: dur, igSlideUrls, igHook, videoUrl, reelVideoUrl, shortPath, videoSec };
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
      // Devotional stories post their complete katha video everywhere, under
      // the Hindi hook title and deity hashtags the channel's best Shorts use
      // — tagged #shorts on YouTube when it's within the 3-minute limit.
      const devotional = p.slot.genre === 'devotional';
      const deityTags = p.slot.deity?.hashtags || [];
      const socialStory = {
        title: (devotional && p.content.socialTitle) || p.content.title,
        text: p.content.text, description: p.igHook || p.content.description,
        genre: p.slot.genre, pageUrl: p.pageUrl, occasionHashtag: p.slot.occasion?.hashtag,
        nextTeaser: devotional ? p.content.nextTeaser : null,
        hashtags: devotional ? [...new Set([...deityTags, ...GENERAL_HASHTAGS, p.slot.occasion?.hashtag].filter(Boolean))] : null,
        isShort: devotional && p.videoSec > 0 && p.videoSec <= 180,
        // Search tags come from the writer, who picked them from what people
        // are typing into YouTube today (lib/trends.js). The raw suggestions
        // aren't used as tags directly: some name other singers or channels,
        // and tagging a video with those is misleading metadata.
        tagWords: devotional ? [...new Set([...(p.content.searchTags || []),
          p.slot.deity?.name.split(' (')[0], 'bhakti', 'hindi story', 'katha', p.slot.occasion?.name].filter(Boolean))] : null,
      };

      // Prefer the narrated video — it carries the audio, the carousel
      // doesn't — and only fall back to the silent carousel/photo post if
      // the video post itself fails, so a story never posts twice.
      // Instagram gets reelVideoUrl: for devotional stories the complete
      // katha video, otherwise the ~85s clip (falling back to the full video
      // when no clipping was needed). Facebook and YouTube get the full video.
      const igReel = p.reelVideoUrl ? await postStoryReel(socialStory, p.reelVideoUrl) : { posted: false };
      if (!igReel.posted) await postStoryCarousel(socialStory, p.igSlideUrls);

      const fbVideo = p.videoUrl ? await postStoryVideo(socialStory, p.videoUrl) : { posted: false };
      if (!fbVideo.posted) await postStoryToFacebook(socialStory, p.igSlideUrls);

      // Independent of whether IG/FB succeeded, so one platform's failure
      // never costs another. Reads straight off local disk, so it doesn't
      // need the Firebase Hosting deploy above to have happened first.
      const ytVideo = p.shortPath || (p.videoUrl && path.join(PUB, 'instagram', mediaKey(p.id), 'story.mp4'));
      const ytPost = ytVideo ? await postStoryToYouTube(socialStory, ytVideo) : { posted: false };
      // The story's page in the app plays its Short too (StoryDetailScreen).
      if (ytPost.posted && ytPost.videoId) {
        await db.collection('stories').doc(p.id).update({ youtubeId: ytPost.videoId, youtubeKind: 'short' })
          .catch((e) => console.warn(`  ⚠️  Short id not saved on ${p.id}: ${e.message}`));
      }
      // The Telegram channel (lib/telegram.js; skips until it's set up).
      await postStoryToTelegram(socialStory, { videoPath: ytVideo, coverPath: path.join(PUB, 'covers', `${p.id}.jpg`) });

      // A question as the first comment on each Short, to start the replies
      // Shorts/Reels ranking weighs heavily. Each needs its own permission
      // (see the setup docs) and just logs when it's missing. None of the
      // APIs can pin a comment — pin it by hand if wanted.
      if (devotional) {
        const deityName = p.slot.deity?.hindi || p.slot.occasion?.name || 'भगवान';
        const question = [p.content.commentQuestion || `🙏 ${deityName} की कौन सी कथा आप अगली बार सुनना चाहेंगे? कमेंट में लिखिए 🙏`,
          p.content.nextTeaser && `🔔 ${p.content.nextTeaser}`].filter(Boolean).join('\n\n');
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
