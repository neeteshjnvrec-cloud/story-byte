/**
 * Builds the *real* story beats for the narrated video/Reel. Unlike the
 * carousel's spoiler-free teaser slides, this walks the actual story
 * start-to-finish and times each scene against the real narration (the
 * per-word cues edge-tts's --write-subtitles produces, see lib/subtitles.js)
 * — so the art on screen tracks what's actually being said instead of
 * cycling through unrelated hook slides at fixed intervals.
 *
 * Returns null on any failure (no Groq, no usable cues, every image fetch
 * failed) — the caller then keeps using the carousel's teaser slides at
 * equal timing, exactly as before this feature existed. Never throws.
 */
const fs = require('fs');
const path = require('path');
let Groq;
try {
  Groq = require('groq-sdk');
} catch {
  Groq = null;
}
const { fetchSceneImage, hashSeed } = require('./scene-image');
const { theme } = require('./genre-theme');
const { extractJson } = require('./carousel-copy');

// Same fallback-chain pattern as carousel-copy.js / build-stories.js — one
// model deprecating outright must not silently kill this feature.
const MODELS = (process.env.GROQ_MODEL_VIDEO_SCENES || 'groq/compound-mini,groq/compound,openai/gpt-oss-20b,openai/gpt-oss-120b')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** ~6s/scene is a reasonable pace for a narrated reel — few enough cuts to
 *  stay legible, many enough that the art keeps tracking the story. Capped
 *  at 6 (not higher) because each scene is a paced pollinations.ai request
 *  (see lib/scene-image.js — one per ~16s, shared with the carousel's own
 *  slides): a long story already pushes total image-generation time past a
 *  couple of minutes without also maximizing this count. */
function sceneCountFor(durationSec) {
  return Math.max(3, Math.min(6, Math.round((durationSec || 60) / 6)));
}

async function llmSceneList({ title, text, genre, description }, count) {
  if (!Groq || !process.env.GROQ_API_KEY) return null;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const sys =
      'You describe scenes for illustrating an audio story as a narrated video. Given a full story, reply with ' +
      'JSON only: {"scenes": [string, ...]}. Exactly ' + count + ' entries, in chronological order, walking the ' +
      'ENTIRE story from beginning to end INCLUDING its resolution — unlike a teaser, this may and should show ' +
      'how it ends. Each entry is a 6-14 word ENGLISH visual description of that exact moment for an illustrator ' +
      '— concrete subject, setting and mood, specific to what actually happens in THIS story at that point (name ' +
      'a well-known deity/mythological/historical figure the story is about if there is one, e.g. Krishna, ' +
      "Ganesha, Rama — but never invent a name for an ordinary fictional character), no text or words rendered " +
      'in the image.';
    const user = `Title: ${title}\nGenre: ${genre}\nDescription: ${description || ''}\n\nStory:\n${String(text || '').slice(0, 6000)}`;

    let completion = null;
    let lastError = null;
    for (const model of MODELS) {
      try {
        completion = await groq.chat.completions.create({
          model,
          temperature: 0.8,
          max_tokens: 700,
          top_p: 0.95,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ],
        });
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!completion) throw lastError || new Error('all video-scene models failed');

    const d = extractJson(completion.choices[0].message.content);
    const scenes = Array.isArray(d.scenes) ? d.scenes.map((s) => String(s || '').trim()).filter(Boolean) : [];
    return scenes.length ? scenes.slice(0, count) : null;
  } catch (e) {
    console.warn(`  ⚠️  Video scene generation failed: ${e.message}`);
    return null;
  }
}

/** Maps scene boundary `fraction` (0..1) onto the real narration timeline.
 *  Cues don't need to line up 1:1 with text.split(/\s+/) — tokenization
 *  differs, especially for non-Latin scripts — they just need to be
 *  chronologically ordered across the whole narration, which edge-tts's
 *  per-word cues are. */
function timeAt(cues, fraction, totalDur) {
  if (fraction <= 0) return 0;
  if (fraction >= 1) return totalDur;
  const idx = Math.min(cues.length - 1, Math.floor(fraction * cues.length));
  return cues[idx].start;
}

/**
 * Returns [{ file, duration }] — real-content scene image files (written
 * under `outDir`) with durations aligned to the real narration — or null.
 */
async function buildVideoScenes({ storyId, title, text, genre, description, cues, audioDurSec, outDir }) {
  if (!cues?.length || !audioDurSec) return null;

  const count = sceneCountFor(audioDurSec);
  const prompts = await llmSceneList({ title, text, genre, description }, count);
  if (!prompts?.length) return null;

  fs.mkdirSync(outDir, { recursive: true });
  const t = theme(genre);
  const scenes = [];
  for (let i = 0; i < prompts.length; i++) {
    const prompt = `${prompts[i]}. ${t.mood}, painterly storybook illustration, cinematic lighting, no text, no words`;
    // A seed space distinct from the carousel's own scene art (`${storyId}-${i}`)
    // so a story's video doesn't just replay its carousel image set.
    const image = await fetchSceneImage(prompt, hashSeed(`${storyId}-video-${i}`));
    if (!image) continue;
    const file = path.join(outDir, `video-scene-${i + 1}.jpg`);
    fs.writeFileSync(file, image);
    const start = timeAt(cues, i / prompts.length, audioDurSec);
    const end = timeAt(cues, (i + 1) / prompts.length, audioDurSec);
    scenes.push({ file, duration: Math.max(1.5, end - start) });
  }
  return scenes.length ? scenes : null;
}

module.exports = { buildVideoScenes };
