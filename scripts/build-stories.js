/**
 * StoryByte content pipeline (runs in GitHub Actions or locally).
 *
 * For each slot: Groq generates the story text (JSON), edge-tts synthesizes a
 * neural-voice MP3, the MP3 is uploaded to Firebase Storage (public), and a
 * story doc is written to Firestore with a DETERMINISTIC id so re-runs are
 * idempotent (no duplicates). Free stack only — no Google Cloud TTS.
 *
 * Env:
 *   GROQ_API_KEY (required), GROQ_MODEL (optional)
 *   FIREBASE_SERVICE_ACCOUNT (JSON string, CI)  OR a local service-account file
 *   FIREBASE_STORAGE_BUCKET (optional; defaults below)
 *   STORY_DATE (optional YYYY-MM-DD; defaults to today)
 */
const admin = require('firebase-admin');
const Groq = require('groq-sdk');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// --- tiny .env loader (local runs) ----------------------------------------
(function loadEnv() {
  try {
    const p = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) {}
})();

const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'storybyte-76716.firebasestorage.app';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const DATE = process.env.STORY_DATE || new Date().toISOString().slice(0, 10);
// Audio hosting: 'github' (GitHub Release assets, free) or 'firebase' (Storage/Blaze).
const AUDIO_HOST = process.env.AUDIO_HOST || 'github';
const GH_REPO = process.env.GITHUB_REPOSITORY || process.env.AUDIO_REPO; // owner/repo
const GH_TAG = process.env.AUDIO_RELEASE_TAG || 'audio';

// --- admin init ------------------------------------------------------------
function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  }
  const local = path.resolve(__dirname, '../functions/firebase-service-account.json');
  if (fs.existsSync(local)) return admin.credential.cert(require(local));
  throw new Error('No Firebase credentials (set FIREBASE_SERVICE_ACCOUNT or provide functions/firebase-service-account.json)');
}
admin.initializeApp({ credential: getCredential(), storageBucket: BUCKET });
const db = admin.firestore();

// --- daily slots -----------------------------------------------------------
const PROMPTS = {
  romance: 'Write a warm, engaging short romance with emotional depth and a satisfying ending.',
  mystery: 'Write a compelling short mystery with a clever, fair twist at the end.',
  adventure: 'Write a fun, wholesome adventure suitable for children aged 5-9, with a gentle lesson.',
  sleep: 'Write a calm, soothing bedtime story with soft imagery and a slow, relaxing pace to help a listener drift to sleep.',
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

async function generateText(groq, slot) {
  const langInstruction = slot.language === 'hi'
    ? 'Write the entire story in natural Hindi (Devanagari script).'
    : 'Write the entire story in English.';
  const sys = `You are a professional storyteller writing narration for an audio app. ${PROMPTS[slot.genre] || PROMPTS.drama} ${langInstruction} ` +
    `Respond with ONLY a JSON object: {"title": string (max 60 chars, no surrounding quotes), "description": string (one enticing sentence), "text": string (the full narration, 450-800 words, natural spoken style, no headings or markdown), "tags": string[] (3-5 lowercase tags)}.`;
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.85,
    max_tokens: 2048,
    top_p: 0.95,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: `Write a ${slot.genre} story as JSON.` },
    ],
  });
  const raw = completion.choices[0].message.content.trim();
  const data = JSON.parse(raw);
  if (!data.title || !data.text) throw new Error('Groq returned incomplete JSON');
  return {
    title: String(data.title).replace(/^["']|["']$/g, '').slice(0, 70),
    description: String(data.description || `A ${slot.genre} story`).slice(0, 160),
    text: String(data.text).trim(),
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 6) : [slot.genre],
  };
}

// Candidate ways to invoke edge-tts (CI installs the CLI; local may use uvx).
const EDGE_CANDIDATES = [
  ['edge-tts', []],
  ['python3', ['-m', 'edge_tts']],
  ['uvx', ['edge-tts']],
];

function synthesize(text, slot, outPath) {
  const txt = path.join(os.tmpdir(), `sb-${Date.now()}.txt`);
  fs.writeFileSync(txt, text, 'utf8');
  const args = ['--voice', slot.voice, '--file', txt, '--write-media', outPath];
  if (slot.rate) args.push(`--rate=${slot.rate}`);
  let lastErr;
  try {
    for (const [cmd, pre] of EDGE_CANDIDATES) {
      try {
        try { fs.existsSync(outPath) && fs.unlinkSync(outPath); } catch (e) {}
        execFileSync(cmd, [...pre, ...args], { stdio: 'pipe' });
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1024) return;
      } catch (e) { lastErr = e; }
    }
  } finally {
    try { fs.unlinkSync(txt); } catch (e) {}
  }
  throw new Error('edge-tts produced no audio (' + (lastErr ? lastErr.message : 'no runner found') + ')');
}

// Upload the MP3 and return a public { audioUrl, audioPath }.
let ghReleaseReady = false;
async function uploadAudio(localMp3, storyId, lang) {
  if (AUDIO_HOST === 'firebase') {
    const dest = `audio/${lang}/${storyId}/full.mp3`;
    const bucket = admin.storage().bucket(BUCKET);
    await bucket.upload(localMp3, {
      destination: dest,
      metadata: { contentType: 'audio/mpeg', cacheControl: 'public,max-age=31536000,immutable' },
    });
    await bucket.file(dest).makePublic();
    return { audioUrl: `https://storage.googleapis.com/${BUCKET}/${dest}`, audioPath: dest };
  }
  // GitHub Release asset (free, CDN-fronted). Asset name is the story id.
  if (!GH_REPO) throw new Error('GITHUB_REPOSITORY/AUDIO_REPO not set for github audio host');
  if (!ghReleaseReady) {
    try {
      execFileSync('gh', ['release', 'view', GH_TAG, '--repo', GH_REPO], { stdio: 'pipe' });
    } catch (e) {
      execFileSync('gh', ['release', 'create', GH_TAG, '--repo', GH_REPO, '--title', 'Story audio', '--notes', 'StoryByte narration assets'], { stdio: 'pipe' });
    }
    ghReleaseReady = true;
  }
  const asset = `${storyId}.mp3`;
  const named = path.join(os.tmpdir(), asset);
  if (named !== localMp3) fs.copyFileSync(localMp3, named);
  execFileSync('gh', ['release', 'upload', GH_TAG, named, '--clobber', '--repo', GH_REPO], { stdio: 'pipe' });
  if (named !== localMp3) { try { fs.unlinkSync(named); } catch (e) {} }
  return {
    audioUrl: `https://github.com/${GH_REPO}/releases/download/${GH_TAG}/${asset}`,
    audioPath: `releases/${GH_TAG}/${asset}`,
  };
}

function durationSec(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
    return Math.round(parseFloat(out)) || 0;
  } catch (e) { return 0; }
}

async function run() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const results = [];

  for (const slot of SLOTS) {
    try {
      const content = await generateText(groq, slot);
      const storyId = `${DATE}_${slot.language}_${slot.genre}_${slug(content.title)}`;

      // idempotency: skip if a completed doc already exists
      const existing = await db.collection('stories').doc(storyId).get();
      if (existing.exists && existing.data().audioUrl) { console.log('skip (exists):', storyId); continue; }

      const mp3 = path.join(os.tmpdir(), `${storyId}.mp3`);
      synthesize(content.text, slot, mp3);
      const duration = durationSec(mp3) || Math.max(60, Math.round(content.text.split(/\s+/).length / 2.5));

      const { audioUrl, audioPath: dest } = await uploadAudio(mp3, storyId, slot.language);
      try { fs.unlinkSync(mp3); } catch (e) {}

      const doc = {
        storyId,
        title: content.title,
        description: content.description,
        genre: slot.genre,
        language: slot.language,
        verticalId: slot.vertical,
        isKids: !!slot.isKids,
        isSleep: !!slot.isSleep,
        episode: 1,
        text: content.text,
        audioUrl,
        audioPath: dest,
        duration,
        rating: 0,
        plays: 0,
        isPremium: false,
        status: 'active',
        isDaily: true,
        generatedDate: DATE,
        voice: slot.voice,
        ttsEngine: 'edge-tts',
        author: 'StoryByte AI',
        tags: content.tags,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('stories').doc(storyId).set(doc, { merge: true });
      console.log('✓', storyId, `(${duration}s, ${slot.voice})`);
      results.push(storyId);
    } catch (e) {
      console.error('✗ slot failed', slot.language, slot.genre, '-', e.message);
    }
  }

  // observability log (admin-only collection)
  try {
    await db.collection('generation_logs').doc(DATE).set({
      date: DATE, count: results.length, storyIds: results, at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (e) {}

  console.log(`\nDone. Generated ${results.length}/${SLOTS.length} stories for ${DATE}.`);
  process.exit(0);
}

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
