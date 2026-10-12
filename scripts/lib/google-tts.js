/**
 * Backup narration via Google Cloud Text-to-Speech, used only when
 * Microsoft's free edge-tts voice is unavailable. That service is
 * unofficial and has refused every request for hours at a time (HTTP 403),
 * which would otherwise cost the day's story.
 *
 * Signs in with the project's Firebase service account
 * (FIREBASE_SERVICE_ACCOUNT, already a secret of every workflow), or
 * GOOGLE_TTS_SERVICE_ACCOUNT if set. Needs the Cloud Text-to-Speech API
 * enabled on that Google Cloud project. Google's free tier covers about
 * 1 million Neural2 characters a month, roughly a year of daily Shorts.
 *
 * Writes the same two files as edge-tts: the mp3, and an .srt with one cue
 * per word. Google returns no timings here, so, as with Sarvam, each
 * sentence-group chunk's real duration is measured and its words are
 * spread across it by length. Never throws: returns null on any failure.
 *
 * Env: GOOGLE_TTS_VOICE (a Google voice name, overriding the automatic
 * choice), GOOGLE_TTS_RATE (speaking rate, default 0.95).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chunkText, srtTime, duration } = require('./sarvam-tts');

/**
 * Speaks each chunk to a file with `speakTo(chunk, file)`, joins them into
 * `out` (mp3) and writes `subsOut` with one cue per word, each chunk's
 * words spread over its measured duration by length. Returns total seconds.
 */
async function narrateChunks({ chunks, dir, out, subsOut, ext, speakTo }) {
  const files = [];
  const cues = [];
  let t = 0;
  for (let i = 0; i < chunks.length; i++) {
    const file = path.join(dir, `chunk-${i}.${ext}`);
    await speakTo(chunks[i], file);
    const d = duration(file);
    if (!d) throw new Error(`chunk ${i + 1} returned no audio`);
    const words = chunks[i].split(' ');
    const weight = words.reduce((sum, w) => sum + w.length + 1, 0);
    let at = t;
    for (const word of words) {
      const span = d * ((word.length + 1) / weight);
      cues.push({ start: at, end: at + span, text: word });
      at += span;
    }
    t += d;
    files.push(file);
  }
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', out], { stdio: 'pipe' });
  if (subsOut) fs.writeFileSync(subsOut, cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n'));
  return t;
}

// Edge voices that are male, so the backup keeps the narrator's gender.
const MALE = /Madhur|Guy|Davis|Andrew|Brian|Christopher|Eric|Roger|Steffan|Ryan|Thomas|Prabhat|Alvaro|Jorge|Henri|Conrad|Killian|Keita|Diego|Antonio|Hamed|Arnav|Kunal/i;
// Explicit voices where Google's default for the language isn't the best one.
const PREFERRED = {
  'hi-IN': { FEMALE: 'hi-IN-Neural2-A', MALE: 'hi-IN-Neural2-B' },
  'en-US': { FEMALE: 'en-US-Neural2-F', MALE: 'en-US-Neural2-D' },
  'en-IN': { FEMALE: 'en-IN-Neural2-A', MALE: 'en-IN-Neural2-B' },
};

function voiceFor(edgeVoice) {
  const languageCode = (String(edgeVoice || '').match(/^[a-z]{2,3}-[A-Z]{2}/) || ['hi-IN'])[0];
  const gender = MALE.test(String(edgeVoice)) ? 'MALE' : 'FEMALE';
  const name = process.env.GOOGLE_TTS_VOICE || PREFERRED[languageCode]?.[gender];
  return { languageCode, ...(name ? { name } : { ssmlGender: gender }) };
}

let tokenCache = null;
async function accessToken() {
  if (tokenCache && tokenCache.exp > Date.now() + 60e3) return tokenCache.token;
  const raw = process.env.GOOGLE_TTS_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const token = await auth.getAccessToken();
  tokenCache = { token, exp: Date.now() + 50 * 60e3 };
  return token;
}

async function speak(text, voice, token) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice,
        audioConfig: { audioEncoding: 'MP3', speakingRate: Number(process.env.GOOGLE_TTS_RATE || 0.95), sampleRateHertz: 24000 },
      }),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.audioContent) throw new Error(json.error?.message || `HTTP ${res.status}`);
    return Buffer.from(json.audioContent, 'base64');
  }
}

/** Returns { subtitlesPath } like edge-tts's synth(), or null. */
async function synthGoogle(text, { out, subsOut, edgeVoice }) {
  let dir;
  try {
    const token = await accessToken();
    if (!token) return null;
    const voice = voiceFor(edgeVoice);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gtts-'));
    const chunks = chunkText(text);
    const t = await narrateChunks({ chunks, dir, out, subsOut, ext: 'mp3', speakTo: async (chunk, file) => fs.writeFileSync(file, await speak(chunk, voice, token)) });
    console.log(`  🎙️  Narrated with Google ${voice.name || `${voice.languageCode} ${voice.ssmlGender}`} (backup voice; ${chunks.length} chunks, ${Math.round(t)}s)`);
    return { subtitlesPath: subsOut && fs.existsSync(subsOut) ? subsOut : null };
  } catch (e) {
    const hint = /has not been used|is disabled|SERVICE_DISABLED/i.test(e.message)
      ? ' — enable the Cloud Text-to-Speech API on the Firebase project (see YOUTUBE-SETUP.md → Backup voice)' : '';
    console.warn(`  ⚠️  Google backup narration failed: ${e.message.split('\n')[0].slice(0, 200)}${hint}`);
    return null;
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { synthGoogle, voiceFor, narrateChunks, MALE };
