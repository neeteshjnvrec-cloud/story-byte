/**
 * Optional premium Hindi narration via Sarvam AI's Bulbul text-to-speech
 * (https://docs.sarvam.ai) — noticeably more natural and expressive than
 * edge-tts, whose flat delivery is the most "template-made" thing about the
 * videos. Used only when SARVAM_API_KEY is set; any failure returns null
 * and the caller falls back to edge-tts, so a missing key or an exhausted
 * credit never costs a day's story.
 *
 * Writes the same two files edge-tts does: the narration mp3, and an .srt
 * with one cue per word. Sarvam returns no timings, so the text is sent in
 * sentence-group chunks, each chunk's real duration is measured, and its
 * words are spread across that duration by length — close enough for
 * captions, and exact at every chunk boundary.
 *
 * Env: SARVAM_API_KEY, SARVAM_SPEAKER (default "shubh"), SARVAM_MODEL
 * (default "bulbul:v3"), SARVAM_PACE (default 0.95).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ENDPOINT = 'https://api.sarvam.ai/text-to-speech';
const CHUNK_CHARS = 450;

function chunkText(text, maxChars = CHUNK_CHARS) {
  const sentences = String(text).replace(/\s+/g, ' ').trim().split(/(?<=[।॥.!?])\s+/).filter(Boolean);
  const chunks = [];
  let cur = '';
  for (const sentence of sentences) {
    if (cur && (cur + ' ' + sentence).length > maxChars) {
      chunks.push(cur);
      cur = sentence;
    } else {
      cur = cur ? `${cur} ${sentence}` : sentence;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

function duration(file) {
  return parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString()) || 0;
}

async function speak(text, languageCode) {
  const body = {
    text,
    language_code: languageCode,
    speaker: process.env.SARVAM_SPEAKER || 'shubh',
    model: process.env.SARVAM_MODEL || 'bulbul:v3',
    pace: Number(process.env.SARVAM_PACE || 0.95),
    speech_sample_rate: 24000,
  };
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'api-subscription-key': process.env.SARVAM_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.audios?.[0]) throw new Error(json.error?.message || json.message || `HTTP ${res.status}`);
    return Buffer.from(json.audios.join(''), 'base64');
  }
}

/** Returns { subtitlesPath } like build-stories.js's synth(), or null. */
async function synthSarvam(text, { out, subsOut, language = 'hi' }) {
  if (!process.env.SARVAM_API_KEY) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sarvam-'));
  try {
    const chunks = chunkText(text);
    const files = [];
    const cues = [];
    let t = 0;
    for (let i = 0; i < chunks.length; i++) {
      const file = path.join(dir, `chunk-${i}.wav`);
      fs.writeFileSync(file, await speak(chunks[i], `${language}-IN`));
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
    if (subsOut) {
      fs.writeFileSync(subsOut, cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n'));
    }
    console.log(`  🎙️  Narrated with Sarvam ${process.env.SARVAM_MODEL || 'bulbul:v3'} (${chunks.length} chunks, ${Math.round(t)}s)`);
    return { subtitlesPath: subsOut && fs.existsSync(subsOut) ? subsOut : null };
  } catch (e) {
    console.warn(`  ⚠️  Sarvam narration failed, using edge-tts: ${e.message}`);
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { synthSarvam, chunkText, srtTime, duration };
