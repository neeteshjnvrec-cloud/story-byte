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
const { fetchSceneImage, fillMissingImages, hashSeed } = require('./scene-image');
const { theme } = require('./genre-theme');
const { extractJson, callGroqJson } = require('./carousel-copy');
const { renderFallbackCover } = require('./fallback-cover');
const sharp = require('sharp');
const { iconographyFor } = require('./iconography');
const { storyArtStyle, shortsStyleKey } = require('./short-style');

// Approved reference portraits (one per figure key, e.g. hanuman.jpg) — see
// assets/deities/README.md. Any image works; it's shrunk under the model's
// 512x512 reference limit.
const DEITY_DIR = path.resolve(__dirname, '..', '..', 'assets', 'deities');
const deityRefs = new Map();
async function deityReference(key) {
  if (!deityRefs.has(key)) {
    const file = ['jpg', 'jpeg', 'png', 'webp'].map((ext) => path.join(DEITY_DIR, `${key}.${ext}`)).find((f) => fs.existsSync(f));
    deityRefs.set(key, file ? await sharp(file).resize(496, 496, { fit: 'inside' }).jpeg({ quality: 92 }).toBuffer() : null);
  }
  return deityRefs.get(key);
}

// Same fallback-chain pattern as carousel-copy.js / build-stories.js — one
// model deprecating outright must not silently kill this feature.
const MODELS = (process.env.GROQ_MODEL_VIDEO_SCENES || 'openai/gpt-oss-120b,openai/gpt-oss-20b,llama-3.3-70b-versatile,qwen/qwen3.8-27b')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** ~6s/scene is a reasonable pace for a narrated reel — few enough cuts to
 *  stay legible, many enough that the art keeps tracking the story. Capped
 *  at 8 (not higher) because each scene is an image-generation call (see
 *  lib/scene-image.js, shared with the carousel's own slides): a long story
 *  already pushes total image-generation time up without also maximizing
 *  this count. */
function sceneCountFor(durationSec) {
  return Math.max(3, Math.min(8, Math.round((durationSec || 60) / 6)));
}

async function llmSceneList({ title, text, genre, description }, count) {
  if (!Groq || !process.env.GROQ_API_KEY) return null;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const sys =
      'You describe scenes for illustrating an audio story as a narrated video. Given a full story, reply with ' +
      'JSON only: {"scenes": [string, ...], "hook": number}. "hook" is the 0-based index of the single most ' +
      'dramatic, visually striking scene (usually the climax) — the video opens on it for two seconds to stop ' +
      'scrollers. Exactly ' + count + ' scene entries, in chronological order, walking the ' +
      'ENTIRE story from beginning to end INCLUDING its resolution — unlike a teaser, this may and should show ' +
      'how it ends. Each entry is a 6-14 word ENGLISH visual description of that exact moment for an illustrator ' +
      '— concrete subject, setting and mood, specific to what actually happens in THIS story at that point (name ' +
      'a well-known deity/mythological/historical figure the story is about if there is one, e.g. Krishna, ' +
      "Ganesha, Rama — but never invent a name for an ordinary fictional character), no text or words rendered " +
      'in the image.' +
      (genre === 'devotional'
        // Names are how lib/iconography.js finds each figure's traditional
        // look — a vague "the god" or "the child" gets drawn however the
        // image model imagines it.
        ? ' Name EVERY deity and figure in the frame by their standard English name — e.g. "Bal Krishna" (Krishna as ' +
          'a child), "Mother Yashoda", "Hanuman", "Lord Shiva", "Shani Dev", "King Vikramaditya" — and keep to what the ' +
          'traditional katha says happens.'
        : '');
    const user = `Title: ${title}\nGenre: ${genre}\nDescription: ${description || ''}\n\nStory:\n${String(text || '').slice(0, 6000)}`;

    // Generous headroom over what the JSON payload itself needs — see
    // callGroqJson in carousel-copy.js for why both response_format modes
    // get tried per model, and why truncating a reasoning model's hidden
    // thinking is how a completion comes back with no JSON in it at all.
    const content = await callGroqJson(groq, MODELS, { sys, user, temperature: 0.8, maxTokens: 4000, topP: 0.95 });
    const d = extractJson(content);
    const scenes = Array.isArray(d.scenes) ? d.scenes.map((s) => String(s || '').trim()).filter(Boolean).slice(0, count) : [];
    if (!scenes.length) return null;
    const hook = Number.isInteger(d.hook) && d.hook > 0 && d.hook < scenes.length ? d.hook : Math.round(scenes.length * 0.7);
    return { scenes, hook: Math.min(hook, scenes.length - 1) };
  } catch (e) {
    console.warn(`  ⚠️  Video scene generation failed: ${e.message}`);
    return null;
  }
}

// Devotional art style comes from DEVOTIONAL_STYLE (lib/short-style.js) —
// a photorealistic epic-film look by default.
function artStyle(genre) {
  return storyArtStyle(genre);
}

// FLUX.2 renders the devotional Shorts' portrait frames natively at 9:16
// (864x1536, scaled to 1080x1920 — 1.25x, not the 1.9x crop-and-blow-up of a
// square). 864x1536 keeps each frame to ~6 of the model's 512px tiles.
const HQ_PORTRAIT = { width: 864, height: 1536 };

/**
 * Returns [{ file, duration }] — real-content scene image files (written
 * under `outDir`) with durations aligned to the real narration — or null.
 * `sceneCount` overrides the default pacing (~6s a scene, capped at 8) —
 * the devotional Shorts ask for more so a ~3-minute story keeps moving.
 */
async function buildVideoScenes({ storyId, title, text, genre, description, cues, audioDurSec, outDir, sceneCount, context = '' }) {
  if (!cues?.length || !audioDurSec) return null;

  const plan = await llmSceneList({ title, text, genre, description }, sceneCount || sceneCountFor(audioDurSec));
  const prompts = plan?.scenes;
  if (!prompts?.length) return null;
  // Boundaries snap to cue starts so each picture changes on a spoken
  // word, not mid-syllable.
  const at = (k) => (k <= 0 ? 0 : k >= prompts.length ? audioDurSec
    : cues[Math.min(cues.length - 1, Math.floor((k / prompts.length) * cues.length))].start);
  const planned = prompts.map((prompt, i) => ({ prompt, start: at(i), end: at(i + 1) }));

  fs.mkdirSync(outDir, { recursive: true });
  const t = theme(genre);
  const scenes = [];
  // Devotional scenes: each figure the scene names gets its traditional
  // appearance in the prompt (lib/iconography.js) and, when one has been
  // approved, its reference portrait from assets/deities/<key>.jpg. Without
  // an approved portrait, the first picture of the story's main figure is
  // reused as the reference for their later scenes, so they at least stay
  // consistent within the video.
  let mainKey = null;
  let mainRef = null;
  const devotional = genre === 'devotional';
  const size = devotional ? { width: 1080, height: 1920 } : { width: 1080, height: 1350 };
  const images = [];
  const requests = [];
  for (let i = 0; i < planned.length; i++) {
    const figures = devotional ? iconographyFor(planned[i].prompt, { context: `${context} ${title}` }) : [];
    const looks = figures.map((f) => f.look).join('. ');
    const approved = [];
    // The approved portraits are lifelike: as references they'd pull a
    // stickman picture back toward realism, so that style draws without them.
    if (shortsStyleKey() !== 'stickman') for (const f of figures) {
      const ref = await deityReference(f.key);
      if (ref) approved.push({ key: f.key, ref });
    }
    const refs = [];
    let refNote = '';
    if (approved.length) {
      approved.slice(0, 3).forEach((a) => refs.push(a.ref));
      refNote = approved.slice(0, 3).map((a, k) => `${figures.find((f) => f.key === a.key).look.split(':')[0]} must look exactly like reference image ${k}`).join('; ');
    } else if (mainRef && figures.some((f) => f.key === mainKey)) {
      refs.push(mainRef);
      refNote = `${figures.find((f) => f.key === mainKey).look.split(':')[0]} must keep the same face, skin colour, costume and ornaments as in reference image 0`;
    }
    const prompt = [planned[i].prompt, looks && `Traditional iconography: ${looks}`, refNote, `${t.mood}, ${artStyle(genre)}`]
      .filter(Boolean).join('. ');
    // A seed space distinct from the carousel's own scene art (`${storyId}-${i}`)
    // so a story's video doesn't just replay its carousel image set.
    // steps: 8 for when FLUX.2 is unavailable (daily allocation used up, or
    // an output it flags): the standard model's sharpest setting.
    const request = [prompt, hashSeed(`${storyId}-video-${i}`),
      devotional ? { ...size, steps: 8, hq: { ...HQ_PORTRAIT, refs } } : undefined];
    requests.push(request);
    const image = await fetchSceneImage(...request);
    if (image && devotional && !mainRef && figures.length) {
      mainKey = figures[0].key;
      // References must be under 512x512.
      mainRef = await sharp(image).resize(496, 496, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
    }
    images.push(image);
  }
  // Never drop a scene outright: these scenes are concatenated back to back
  // against a fixed narration track — skipping one shrinks the video below
  // the audio's real length, so ffmpeg's `-shortest` cuts the narration off
  // early. A failed picture gets another try, then a reframed neighbour; a
  // themed card only if no picture came through at all.
  const filled = await fillMissingImages(images, {
    retry: (i) => fetchSceneImage(...requests[i]),
    fallback: () => renderFallbackCover(genre, size),
    ...size,
  });
  const sources = {};
  filled.forEach((image, i) => {
    const file = path.join(outDir, `video-scene-${i + 1}.jpg`);
    fs.writeFileSync(file, image);
    const source = image.source || 'card';
    sources[source] = (sources[source] || 0) + 1;
    // lowRes: anything but FLUX.2 is already a scaled-up crop, which a
    // close-up (lib/close-ups.js) would blow up further into a blur.
    scenes.push({ file, duration: Math.max(1.5, planned[i].end - planned[i].start), lowRes: source !== 'hq' });
  });
  // Hook first (devotional Shorts): the opening ~2s show the most striking
  // picture — the climax — over the narration's opening hook line, then the
  // story starts from the beginning. The first seconds decide whether a
  // Shorts viewer keeps watching.
  const hookAt = plan.hook;
  const first = scenes[0];
  const hookSec = Math.min(2.2, first.duration * 0.6);
  if (devotional && scenes.length >= 4 && hookAt > 0 && first.duration - hookSec >= 1.5) {
    scenes.splice(0, 1,
      { file: scenes[hookAt].file, duration: hookSec, lowRes: scenes[hookAt].lowRes },
      { ...first, duration: first.duration - hookSec });
    console.log(`  🎬 Opens on scene ${hookAt + 1} (the hook) for ${hookSec.toFixed(1)}s`);
  }
  console.log(`  🖼️  Video pictures: ${Object.entries(sources).map(([k, n]) => `${n} ${k}`).join(', ')}` +
    (sources.hq === filled.length ? '' : ' (hq = FLUX.2; reused = a neighbouring picture reframed; the rest are lower quality)'));
  return scenes.length ? scenes : null;
}

module.exports = { buildVideoScenes };
