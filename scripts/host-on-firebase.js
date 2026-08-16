/**
 * Host story audio + covers on Firebase Hosting (free on Spark).
 *
 * For every edge-tts story in Firestore: generate a cover image (Pollinations,
 * free), synthesize the audio from the stored text (edge-tts), stage both under
 * ./public, deploy Hosting once, then update each doc's audioUrl + coverImage
 * to the public storybyte-76716.web.app URLs.
 *
 * Reused by the daily pipeline (see build-stories.js exporting synth+cover).
 */
const admin = require('firebase-admin');
const { execFileSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SA = path.join(ROOT, 'functions/firebase-service-account.json');
const PROJECT = 'storybyte-76716';
const SITE = 'https://storybyte-76716.web.app';
const PUB = path.join(ROOT, 'public');

admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

const EDGE = [['edge-tts', []], ['uvx', ['edge-tts']], ['python3', ['-m', 'edge_tts']]];
function synth(text, voice, rate, out) {
  const txt = path.join(os.tmpdir(), `sb-${Date.now()}.txt`);
  fs.writeFileSync(txt, text, 'utf8');
  const args = ['--voice', voice, '--file', txt, '--write-media', out];
  if (rate) args.push(`--rate=${rate}`);
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

function hashSeed(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000; return h; }

function coverPrompt(story) {
  const mood = story.isSleep ? 'calm dreamy nighttime, soft moonlight' :
    story.isKids ? 'bright cheerful playful cartoon' :
    story.genre === 'mystery' ? 'moody atmospheric, muted tones' :
    story.genre === 'romance' ? 'warm golden tender' : 'warm cinematic';
  const subject = (story.description || story.title || story.genre).slice(0, 120);
  return `${subject}. Storybook cover illustration, ${mood}, painterly, cozy, high detail, no text, no words, no letters`;
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

async function run() {
  fs.mkdirSync(path.join(PUB, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(PUB, 'covers'), { recursive: true });
  fs.writeFileSync(path.join(PUB, 'index.html'), '<!doctype html><title>StoryByte CDN</title><h1>StoryByte content</h1>');

  const snap = await db.collection('stories').where('ttsEngine', '==', 'edge-tts').get();
  console.log('processing', snap.size, 'stories');
  const updates = [];

  for (const doc of snap.docs) {
    const s = doc.data();
    const id = doc.id;
    try {
      // cover
      const seed = hashSeed(id);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt(s))}?width=768&height=768&nologo=true&seed=${seed}&model=flux`;
      const coverPath = path.join(PUB, 'covers', `${id}.jpg`);
      await fetchImage(url, coverPath);
      console.log('  cover ✓', id, `(${Math.round(fs.statSync(coverPath).size / 1024)}KB)`);

      // audio (from stored text)
      const audioPath = path.join(PUB, 'audio', `${id}.mp3`);
      synth(s.text, s.voice || 'en-US-AriaNeural', s.isSleep ? '-18%' : null, audioPath);
      console.log('  audio ✓', id, `(${Math.round(fs.statSync(audioPath).size / 1024)}KB)`);

      updates.push({ ref: doc.ref, audioUrl: `${SITE}/audio/${id}.mp3`, coverImage: `${SITE}/covers/${id}.jpg` });
    } catch (e) {
      console.error('  ✗', id, '-', e.message);
    }
  }

  // deploy hosting
  console.log('deploying to Firebase Hosting…');
  const fbJson = path.join(PUB, 'firebase.json');
  fs.writeFileSync(fbJson, JSON.stringify({ hosting: { public: '.', ignore: ['firebase.json'] } }));
  execFileSync('npx', ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
    { cwd: PUB, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SA } });
  try { fs.unlinkSync(fbJson); } catch (e) {}

  // update docs
  for (const u of updates) {
    await u.ref.set({ audioUrl: u.audioUrl, coverImage: u.coverImage, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
  console.log(`\nDone. Hosted + updated ${updates.length} stories at ${SITE}`);
  process.exit(0);
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
