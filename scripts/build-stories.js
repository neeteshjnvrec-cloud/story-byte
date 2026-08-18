/**
 * StoryByte daily content pipeline (GitHub Actions or local).
 *
 * Per slot: Groq writes the story (JSON) → Pollinations generates a matching
 * cover → edge-tts synthesizes neural narration → files are staged under
 * ../public → Firebase Hosting is deployed once (free on Spark) → a story doc
 * is written to Firestore with the public web.app URLs. Deterministic IDs keep
 * re-runs idempotent. Committed public/ files persist across daily runs.
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

// --- credentials: resolve a service-account file path (needed for both admin + firebase deploy) ---
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
};
const SLOTS = [
  { language: 'en', genre: 'romance',   vertical: 'fiction', voice: 'en-US-AriaNeural' },
  { language: 'en', genre: 'mystery',   vertical: 'fiction', voice: 'en-US-GuyNeural' },
  { language: 'en', genre: 'adventure', vertical: 'kids',    voice: 'en-US-AnaNeural',  isKids: true },
  { language: 'en', genre: 'sleep',     vertical: 'bedtime', voice: 'en-US-JennyNeural', isSleep: true, rate: '-18%' },
  { language: 'hi', genre: 'drama',     vertical: 'hindi',   voice: 'hi-IN-SwaraNeural' },
  { language: 'hi', genre: 'romance',   vertical: 'hindi',   voice: 'hi-IN-MadhurNeural' },
];

const slug = (s) => (s || 'story').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
const hashSeed = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000; return h; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Groq free tier rate-limits bursty requests (returns 429, sometimes 413).
// Retry transient errors with exponential backoff + jitter.
async function withRetry(fn, { attempts = 6, baseMs = 2000, label = 'call' } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e && e.message || e);
      const transient = e && (e.status === 429 || e.status === 413 || e.status === 500 || e.status === 502 || e.status === 503)
        || /rate.?limit|too many|413|429|entity too large|overloaded|server error/i.test(msg);
      if (!transient || i === attempts - 1) throw e;
      const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 1000);
      console.log(`  … ${label}: transient error (${msg.slice(0, 60)}), retry ${i + 1}/${attempts - 1} in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function generateText(groq, slot) {
  const langInstruction = slot.language === 'hi'
    ? 'Write the entire story in natural Hindi (Devanagari script).'
    : 'Write the entire story in English.';
  const sys = `You are a professional storyteller writing narration for an audio app. ${PROMPTS[slot.genre] || PROMPTS.drama} ${langInstruction} ` +
    `Respond with ONLY JSON: {"title": string (max 60 chars), "description": string (one enticing sentence), "text": string (full narration, 450-800 words, natural spoken style, no markdown), "tags": string[]}.`;
  const c = await withRetry(() => groq.chat.completions.create({
    model: MODEL, temperature: 0.85, max_tokens: 4096, top_p: 0.95,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: sys }, { role: 'user', content: `Write a ${slot.genre} story as JSON.` }],
  }), { label: `groq:${slot.language}/${slot.genre}` });
  const raw = c.choices[0].message.content.trim();
  // Reasoning models (groq/compound) may emit a thinking preamble before the
  // JSON. Parse directly if clean; otherwise scan brace positions from the end
  // until a slice parses as a complete JSON object (the real payload is the
  // last {...} in the text, so the first parseable candidate wins).
  let d;
  try {
    d = JSON.parse(raw);
  } catch (_) {
    const end = raw.lastIndexOf('}');
    let ok = false;
    for (let i = raw.lastIndexOf('{'); i >= 0 && !ok; i = raw.lastIndexOf('{', i - 1)) {
      try { d = JSON.parse(raw.slice(i, end + 1)); ok = true; } catch (e) {}
    }
    if (!ok) throw new Error('no JSON in response');
  }
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
async function fetchImageWithRetry(url, out, { attempts = 3, baseMs = 3000, label = 'image' } = {}) {
  return withRetry(() => fetchImage(url, out), { attempts, baseMs, label });
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

async function run() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  fs.mkdirSync(path.join(PUB, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(PUB, 'covers'), { recursive: true });
  if (!fs.existsSync(path.join(PUB, 'index.html'))) fs.writeFileSync(path.join(PUB, 'index.html'), '<!doctype html><title>StoryByte CDN</title><h1>StoryByte content</h1>');

  // Guard: skip if any story for this date already published (prevent duplicates on re-runs)
  const todayCountSnap = await db.collection('stories').where('generatedDate', '==', DATE).count().get();
  const todayCount = todayCountSnap.data().count;
  if (todayCount > 0) {
    console.log(`Already ${todayCount} stories for ${DATE} — skipping.`);
    process.exit(0);
  }

  const pending = [];
  for (let s = 0; s < SLOTS.length; s++) {
    const slot = SLOTS[s];
    if (s > 0) await sleep(3000); // stay under Groq free-tier burst limits
    try {
      const content = await generateText(groq, slot);
      const id = `${DATE}_${slot.language}_${slot.genre}_${slug(content.title)}`;
      const existing = await db.collection('stories').doc(id).get();
      if (existing.exists && existing.data().audioUrl) { console.log('skip (exists):', id); continue; }

      const cover = path.join(PUB, 'covers', `${id}.jpg`);
      await fetchImageWithRetry(`https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt(slot, content))}?width=768&height=768&nologo=true&seed=${hashSeed(id)}&model=flux`, cover, { label: `cover:${slot.language}/${slot.genre}` });
      const audio = path.join(PUB, 'audio', `${id}.mp3`);
      synth(content.text, slot, audio);
      const duration = durationSec(audio) || Math.max(60, Math.round(content.text.split(/\s+/).length / 2.5));
      console.log('generated', id, `(${duration}s)`);

      pending.push({ id, slot, content, duration });
    } catch (e) { console.error('✗ slot', slot.language, slot.genre, '-', e.message); }
  }

  if (pending.length === 0) { console.log('Nothing new to publish.'); process.exit(0); }

  // Deploy all staged files to Firebase Hosting once.
  console.log('deploying', pending.length, 'to Firebase Hosting…');
  execFileSync('npx', ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SA_PATH } });

  // Write docs with live URLs.
  for (const p of pending) {
    await db.collection('stories').doc(p.id).set({
      storyId: p.id, title: p.content.title, description: p.content.description,
      genre: p.slot.genre, language: p.slot.language, verticalId: p.slot.vertical,
      isKids: !!p.slot.isKids, isSleep: !!p.slot.isSleep, episode: 1,
      text: p.content.text,
      audioUrl: `${SITE}/audio/${p.id}.mp3`, coverImage: `${SITE}/covers/${p.id}.jpg`,
      duration: p.duration, rating: 0, plays: 0, isPremium: false, status: 'active', isDaily: true,
      generatedDate: DATE, voice: p.slot.voice, ttsEngine: 'edge-tts', author: 'StoryByte AI', tags: p.content.tags,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('✓ doc', p.id);
  }
  try { await db.collection('generation_logs').doc(DATE).set({ date: DATE, count: pending.length, at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch (e) {}
  
  // Send notifications after successful deploy
  await sendNotificationWebhook(pending);
  
  console.log(`\nDone. Published ${pending.length} stories for ${DATE}.`);
  
  // Send notifications after successful deploy
  const { sendNotifications } = require('./send-notifications');
  await sendNotifications(pending.map(p => ({ id: p.id, title: p.content.title, genre: p.slot.genre, language: p.slot.language, coverImage: `${SITE}/covers/${p.id}.jpg` })));
  
  process.exit(0);
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });

// --- Send notification webhook after stories are published ---
async function sendNotificationWebhook(stories) {
  if (stories.length === 0) return;
  const funcUrl = process.env.FIREBASE_FUNCTIONS_URL || 'https://us-central1-storybyte-76716.cloudfunctions.net/triggerStoryGeneration';
  try {
    console.log('📩 Sending notification webhook...');
    const res = await fetch(`${funcUrl}?count=${stories.length}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('✅ Notifications sent:', data.count, 'stories');
  } catch (e) {
    console.warn('⚠️ Notification webhook failed:', e.message);
    // Don't fail the pipeline if notifications fail
  }
}
