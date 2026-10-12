/**
 * Free backup narration via the Gemini API's text-to-speech models, for
 * when Microsoft's free edge-tts voice is refusing requests. A Gemini API
 * key from Google AI Studio is free and needs no card or billing account
 * (GEMINI_API_KEY). The free tier allows only about 10 speech requests a
 * day, so the text goes in long pieces (~1,200 characters, about a minute
 * and a half of Hindi): a daily Short with its teaser is about 3 requests.
 *
 * The model returns raw 24 kHz PCM with no timings. As with Sarvam and
 * Google Cloud TTS, each piece's real duration is measured and its words
 * are spread across it for captions (lib/google-tts.js narrateChunks).
 * Never throws: returns null on any failure, including a used-up quota.
 *
 * Env: GEMINI_API_KEY; GEMINI_TTS_MODEL (default: the models below, tried
 * in order); GEMINI_TTS_VOICE (a Gemini voice name, overriding the choice).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chunkText } = require('./sarvam-tts');
const { narrateChunks, MALE } = require('./google-tts');

const MODELS = (process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts,gemini-2.5-flash-tts,gemini-2.5-pro-preview-tts')
  .split(',').map((m) => m.trim()).filter(Boolean);
const CHUNK_CHARS = 1200;

function voiceName(edgeVoice) {
  if (process.env.GEMINI_TTS_VOICE) return process.env.GEMINI_TTS_VOICE;
  // Kore: warm, clear female; Charon: calm, deep male.
  return MALE.test(String(edgeVoice)) ? 'Charon' : 'Kore';
}

let workingModel = null;

async function speak(text, voice, file) {
  const models = workingModel ? [workingModel] : MODELS;
  let lastError;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Read this aloud as a warm, calm devotional storyteller, at a gentle pace:\n\n${text}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      const data = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (res.ok && data) {
        workingModel = model;
        const pcm = `${file}.pcm`;
        fs.writeFileSync(pcm, Buffer.from(data, 'base64'));
        execFileSync('ffmpeg', ['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm, '-c:a', 'libmp3lame', '-b:a', '128k', file], { stdio: 'pipe' });
        fs.rmSync(pcm, { force: true });
        return;
      }
      lastError = new Error(`${model}: ${json.error?.message || `HTTP ${res.status}`}`);
      if (res.status === 404 || res.status === 400) break; // model not available: try the next one
      // A per-minute limit clears in under a minute; a used-up daily quota doesn't.
      if (res.status === 429 && !/per day|PerDay/i.test(json.error?.message || '') && attempt < 2) {
        await new Promise((r) => setTimeout(r, 35000));
        continue;
      }
      if (res.status >= 500 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error('no Gemini TTS model available');
}

/** Returns { subtitlesPath } like edge-tts's synth(), or null. */
async function synthGemini(text, { out, subsOut, edgeVoice, maxChars = CHUNK_CHARS }) {
  if (!process.env.GEMINI_API_KEY) return null;
  let dir;
  try {
    const voice = voiceName(edgeVoice);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gemini-'));
    const chunks = chunkText(text, maxChars);
    const t = await narrateChunks({ chunks, dir, out, subsOut, ext: 'mp3', speakTo: (chunk, file) => speak(chunk, voice, file) });
    console.log(`  🎙️  Narrated with Gemini ${workingModel} voice ${voice} (free backup voice; ${chunks.length} pieces, ${Math.round(t)}s)`);
    return { subtitlesPath: subsOut && fs.existsSync(subsOut) ? subsOut : null };
  } catch (e) {
    console.warn(`  ⚠️  Gemini backup narration failed: ${e.message.split('\n')[0].slice(0, 200)}`);
    return null;
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { synthGemini };
