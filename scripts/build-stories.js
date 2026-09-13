/**
 * StoryByte daily content pipeline (GitHub Actions or local).
 *
 * Generates exactly 2 random stories per day. Failed stories are retried
 * the next day (same slot) — never skips ahead.
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
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { notifyAndPushAll } = require('./lib/notify');
const { writeStoryPage } = require('./lib/story-page');
const { buildCarouselSlides } = require('./lib/carousel-slides');
const { postStoryCarousel } = require('./lib/instagram');
const { postStoryToFacebook } = require('./lib/facebook');
const { getOccasion, occasionPhrase } = require('./occasions');

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
function parseModels(envValue) {
  if (!envValue) return ['qwen/qwen3.6-27b', 'openai/gpt-oss-20b', 'groq/compound', 'openai/gpt-oss-120b'];
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
const SLOTS = [
  { language: 'en', genre: 'romance',    vertical: 'fiction', voice: 'en-US-AriaNeural' },
  { language: 'en', genre: 'mystery',    vertical: 'fiction', voice: 'en-US-GuyNeural' },
  { language: 'en', genre: 'adventure',  vertical: 'kids',    voice: 'en-US-AnaNeural',  isKids: true },
  { language: 'en', genre: 'sleep',      vertical: 'bedtime', voice: 'en-US-JennyNeural', isSleep: true, rate: '-18%' },
  { language: 'en', genre: 'motivation', vertical: 'fiction', voice: 'en-US-GuyNeural' },
  { language: 'en', genre: 'devotional', vertical: 'fiction', voice: 'en-US-AriaNeural' },
  { language: 'hi', genre: 'drama',      vertical: 'hindi',   voice: 'hi-IN-SwaraNeural' },
  { language: 'hi', genre: 'mystery',    vertical: 'hindi',   voice: 'hi-IN-SwaraNeural' },
  { language: 'hi', genre: 'adventure',  vertical: 'hindi',   voice: 'hi-IN-SwaraNeural',  isKids: true },
  { language: 'hi', genre: 'sleep',      vertical: 'hindi',   voice: 'hi-IN-SwaraNeural', isSleep: true, rate: '-18%' },
  { language: 'hi', genre: 'motivation', vertical: 'hindi',   voice: 'hi-IN-SwaraNeural' },
  { language: 'hi', genre: 'devotional', vertical: 'hindi',   voice: 'hi-IN-SwaraNeural' },
];

const slug = (s) => (s || 'story').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
const hashSeed = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000; return h; };

// Shuffle array (Fisher-Yates)
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
  const sys = `You are a storyteller for an audio app. ${PROMPTS[slot.genre] || PROMPTS.drama}${occasionInstruction} Write in ${langInstruction} ` +
    `JSON only: {"title":"max 60 chars","description":"one sentence","text":"450-800 words, spoken style, no markdown","tags":["genre"]}.`;
  const userPrompt = slot.occasion ? `Write a story for ${slot.occasion.name}.` : `Write a ${slot.genre} story.`;

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
  const finalSubject = occasion ? `${occasion.visual}, ${occasion.name} celebration` : subject;
  return `${finalSubject}. Storybook cover illustration, ${mood}, painterly, cozy, high detail, no text, no words`;
}

function fetchImage(url, out) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(out);
    https.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('img HTTP ' + res.statusCode)); }
      res.pipe(f); f.on('finish', () => f.close(() => resolve()));
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('img timeout')); });
  });
}

const EDGE = [['edge-tts', []], ['python3', ['-m', 'edge_tts']], ['uvx', ['edge-tts']]];
function synth(text, slot, out) {
  const txt = path.join(os.tmpdir(), `sb-${Date.now()}.txt`);
  fs.writeFileSync(txt, text, 'utf8');
  const args = ['--voice', slot.voice, '--file', txt, '--write-media', out];
  if (slot.rate) args.push(`--rate=${slot.rate}`);
  let ok = false, err;
  for (const [cmd, pre] of EDGE) {
    try { try { fs.existsSync(out) && fs.unlinkSync(out); } catch (e) {}
      execFileSync(cmd, [...pre, ...args], { stdio: 'pipe' });
      if (fs.existsSync(out) && fs.statSync(out).size > 1024) { ok = true; break; }
    } catch (e) { err = e; }
  }
  try { fs.unlinkSync(txt); } catch (e) {}
  if (!ok) throw new Error('edge-tts failed: ' + (err && err.message));
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

  // Prioritize failed slots for retry
  const pendingSlots = [];
  for (const failed of failedSlots) {
    const match = available.find(s => s.language === failed.language && s.genre === failed.genre);
    if (match) {
      pendingSlots.push({ ...match, retry: true });
      available = available.filter(s => !(s.language === match.language && s.genre === match.genre));
    }
  }

  // Fill remaining with random slots until we hit DAILY_COUNT
  const shuffled = shuffle(available);
  while (pendingSlots.length < DAILY_COUNT && shuffled.length > 0) {
    pendingSlots.push({ ...shuffled.pop(), retry: false });
  }

  // If today is a festival/observance, dedicate one of today's slots to it —
  // reuse a slot whose genre already matches (so voice/vertical stay
  // sensible), or just retheme the first slot if none matches, since the
  // whole point is that at least one story today is timely.
  const occasion = getOccasion(DATE);
  if (occasion && pendingSlots.length > 0) {
    console.log(`🎉 Today's occasion: ${occasion.name}`);
    const idx = pendingSlots.findIndex((s) => s.genre === occasion.genre);
    const target = idx >= 0 ? idx : 0;
    pendingSlots[target] = { ...pendingSlots[target], genre: occasion.genre, occasion };
  }

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

        // Step 2: Generate cover
        const cover = path.join(PUB, 'covers', `${id}.jpg`);
        await fetchImage(
          `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt(slot, content))}?width=768&height=768&nologo=true&seed=${hashSeed(id)}&model=flux`,
          cover
        );

        // Step 3: Generate audio
        const audio = path.join(PUB, 'audio', `${id}.mp3`);
        synth(content.text, slot, audio);
        const dur = durationSec(audio) || Math.max(60, Math.round(content.text.split(/\s+/).length / 2.5));

        console.log(`✅ generated ${id} (${dur}s)`);

        // Step 4: Render Instagram carousel slides (cover + story-arc quote
        // cards + CTA). Written alongside the audio/cover so the single
        // deploy below carries them too; the actual IG post happens after
        // the story is written to Firestore as published.
        let igSlideUrls = [];
        let igHook = null;
        try {
          const built = await buildCarouselSlides({
            storyId: id, title: content.title, text: content.text, genre: slot.genre, description: content.description,
            coverPath: cover, outDir: path.join(PUB, 'instagram', id), siteUrl: SITE,
          });
          igSlideUrls = built.urls;
          igHook = built.hook;
        } catch (e) {
          console.warn(`  ⚠️  Carousel render failed for ${id}: ${e.message}`);
        }

        generated = { id, slot, content, duration: dur, igSlideUrls, igHook };
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
      const socialStory = {
        title: p.content.title, text: p.content.text, description: p.igHook || p.content.description,
        genre: p.slot.genre, pageUrl: p.pageUrl, occasionHashtag: p.slot.occasion?.hashtag,
      };
      await postStoryCarousel(socialStory, p.igSlideUrls);
      await postStoryToFacebook(socialStory, p.igSlideUrls);
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
