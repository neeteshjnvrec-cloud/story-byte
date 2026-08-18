/**
 * StoryByte daily content pipeline (GitHub Actions or local).
 *
 * Generates exactly 2 random stories per day. Failed stories are retried
 * the next day (same slot) — never skips ahead.
 *
 * Env: GROQ_API_KEY (req), GROQ_MODEL, FIREBASE_SERVICE_ACCOUNT (JSON, CI) or a
 *      local functions/firebase-service-account.json, STORY_DATE (opt).
 */
const admin = require('firebase-admin');
const Groq = require('groq-sdk');
const { execFileSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'storybyte-76716';
const SITE = process.env.HOSTING_SITE || `https://${PROJECT}.web.app`;
const MODEL = process.env.GROQ_MODEL || 'groq/compound';
const DATE = process.env.STORY_DATE || new Date().toISOString().slice(0, 10);
const DAILY_COUNT = 2; // Exactly 2 stories per day
const MAX_RETRIES = 3; // Retry failed slots up to 3 times

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
  const langInstruction = slot.language === 'hi'
    ? 'Write the entire story in natural Hindi (Devanagari script).'
    : 'Write the entire story in English.';
  const sys = `You are a professional storyteller writing narration for an audio app. ${PROMPTS[slot.genre] || PROMPTS.drama} ${langInstruction} ` +
    `Respond with ONLY JSON: {"title": string (max 60 chars), "description": string (one enticing sentence), "text": string (full narration, 450-800 words, natural spoken style, no markdown), "tags": string[]}.`;
  const c = await groq.chat.completions.create({
    model: MODEL, temperature: 0.85, max_tokens: 2048, top_p: 0.95,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: sys }, { role: 'user', content: `Write a ${slot.genre} story as JSON.` }],
  });
  const d = JSON.parse(c.choices[0].message.content.trim());
  if (!d.title || !d.text) throw new Error('incomplete JSON');
  return {
    title: String(d.title).replace(/^["']|["']$/g, '').slice(0, 70),
    description: String(d.description || `A ${slot.genre} story`).slice(0, 160),
    text: String(d.text).trim(),
    tags: Array.isArray(d.tags) ? d.tags.slice(0, 6) : [slot.genre],
  };
}

function coverPrompt(slot, content) {
  const mood = slot.isSleep ? 'calm dreamy nighttime, soft moonlight' :
    slot.isKids ? 'bright cheerful playful cartoon' :
    slot.genre === 'mystery' ? 'moody atmospheric, muted tones' :
    slot.genre === 'romance' ? 'warm golden tender' : 'warm cinematic';
  return `${content.description || content.title}. Storybook cover illustration, ${mood}, painterly, cozy, high detail, no text, no words`;
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
  // Store notification in Firestore for the app to read
  await db.collection('notifications').add({
    type: 'new_story',
    title: `New ${story.genre} story`,
    body: story.title,
    storyId: story.storyId,
    genre: story.genre,
    coverImage: story.coverImage,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function run() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  fs.mkdirSync(path.join(PUB, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(PUB, 'covers'), { recursive: true });
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
        generated = { id, slot, content, duration: dur };
        await markSlotSuccess(slot);
        usedSlots.add(slotKey);
      } catch (e) {
        console.error(`✗ attempt ${attempts}:`, e.message);
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

  // CRITICAL: Only deploy if we have exactly DAILY_COUNT proper stories
  console.log(`\n📊 Generated: ${pending.length}/${DAILY_COUNT} stories`);

  if (pending.length === 0) {
    console.log('❌ No stories generated — nothing to deploy.');
    process.exit(0);
  }

  if (pending.length < DAILY_COUNT) {
    console.log(`⚠️  Only ${pending.length} stories generated (expected ${DAILY_COUNT}). NOT deploying.`);
    console.log('Run the script again tomorrow to retry failed slots.');
    process.exit(0);
  }

  // Deploy all staged files to Firebase Hosting once.
  console.log(`\n🚀 Deploying ${pending.length} stories to Firebase Hosting...`);
  execFileSync('npx', ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SA_PATH } });

  // Write docs to Firestore and create notifications
  for (const p of pending) {
    const storyData = {
      storyId: p.id, title: p.content.title, description: p.content.description,
      genre: p.slot.genre, language: p.slot.language, verticalId: p.slot.vertical,
      isKids: !!p.slot.isKids, isSleep: !!p.slot.isSleep, episode: 1,
      text: p.content.text,
      audioUrl: `${SITE}/audio/${p.id}.mp3`, coverImage: `${SITE}/covers/${p.id}.jpg`,
      duration: p.duration, rating: 0, plays: 0, isPremium: false, status: 'active', isDaily: true,
      generatedDate: DATE, voice: p.slot.voice, ttsEngine: 'edge-tts', author: 'StoryByte AI', tags: p.content.tags,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('stories').doc(p.id).set(storyData, { merge: true });
    console.log('✓ doc', p.id);

    // Create notification for this story
    await createNotification({
      storyId: p.id,
      title: p.content.title,
      genre: p.slot.genre,
      coverImage: `${SITE}/covers/${p.id}.jpg`,
    });
  }

  // Log generation
  await db.collection('generation_logs').doc(DATE).set({
    date: DATE, count: pending.length, expected: DAILY_COUNT, failed: failedToday.length, at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(`\n✅ Done. Published ${pending.length}/${DAILY_COUNT} stories for ${DATE}.`);
  process.exit(0);
}

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
