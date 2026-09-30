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
const { extractJson, callGroqJson } = require('./carousel-copy');
const { renderFallbackCover } = require('./fallback-cover');

// Same fallback-chain pattern as carousel-copy.js / build-stories.js — one
// model deprecating outright must not silently kill this feature.
const MODELS = (process.env.GROQ_MODEL_VIDEO_SCENES || 'groq/compound-mini,groq/compound,openai/gpt-oss-20b,openai/gpt-oss-120b')
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
      'JSON only: {"scenes": [string, ...]}. Exactly ' + count + ' entries, in chronological order, walking the ' +
      'ENTIRE story from beginning to end INCLUDING its resolution — unlike a teaser, this may and should show ' +
      'how it ends. Each entry is a 6-14 word ENGLISH visual description of that exact moment for an illustrator ' +
      '— concrete subject, setting and mood, specific to what actually happens in THIS story at that point (name ' +
      'a well-known deity/mythological/historical figure the story is about if there is one, e.g. Krishna, ' +
      "Ganesha, Rama — but never invent a name for an ordinary fictional character), no text or words rendered " +
      'in the image.';
    const user = `Title: ${title}\nGenre: ${genre}\nDescription: ${description || ''}\n\nStory:\n${String(text || '').slice(0, 6000)}`;

    // Generous headroom over what the JSON payload itself needs — see
    // callGroqJson in carousel-copy.js for why both response_format modes
    // get tried per model, and why truncating a reasoning model's hidden
    // thinking is how a completion comes back with no JSON in it at all.
    const content = await callGroqJson(groq, MODELS, { sys, user, temperature: 0.8, maxTokens: 1600, topP: 0.95 });
    const d = extractJson(content);
    const scenes = Array.isArray(d.scenes) ? d.scenes.map((s) => String(s || '').trim()).filter(Boolean) : [];
    return scenes.length ? scenes.slice(0, count) : null;
  } catch (e) {
    console.warn(`  ⚠️  Video scene generation failed: ${e.message}`);
    return null;
  }
}

// The devotional Shorts that do well on this channel (1K-41K views) are
// hyper-real "divine" renders, not storybook paintings.
function artStyle(genre) {
  return genre === 'devotional'
    ? 'divine hyper-realistic cinematic art, glowing golden aura, rich colours, 8K detail, ' +
      'main figure centred in the frame, no text, no words'
    : 'painterly storybook illustration, cinematic lighting, no text, no words';
}

/**
 * Returns [{ file, duration }] — real-content scene image files (written
 * under `outDir`) with durations aligned to the real narration — or null.
 * `sceneCount` overrides the default pacing (~6s a scene, capped at 8) —
 * the devotional Shorts ask for more so a ~3-minute story keeps moving.
 */
async function buildVideoScenes({ storyId, title, text, genre, description, cues, audioDurSec, outDir, sceneCount }) {
  if (!cues?.length || !audioDurSec) return null;

  const prompts = await llmSceneList({ title, text, genre, description }, sceneCount || sceneCountFor(audioDurSec));
  if (!prompts?.length) return null;
  // Boundaries snap to cue starts so each picture changes on a spoken
  // word, not mid-syllable.
  const at = (k) => (k <= 0 ? 0 : k >= prompts.length ? audioDurSec
    : cues[Math.min(cues.length - 1, Math.floor((k / prompts.length) * cues.length))].start);
  const planned = prompts.map((prompt, i) => ({ prompt, start: at(i), end: at(i + 1) }));

  fs.mkdirSync(outDir, { recursive: true });
  const t = theme(genre);
  const scenes = [];
  for (let i = 0; i < planned.length; i++) {
    const prompt = `${planned[i].prompt}. ${t.mood}, ${artStyle(genre)}`;
    // A seed space distinct from the carousel's own scene art (`${storyId}-${i}`)
    // so a story's video doesn't just replay its carousel image set.
    // Devotional Shorts are cropped to full-screen 9:16 later
    // (lib/caption-frames.js): keep the whole square render so that crop
    // can centre on the deity, instead of pre-cutting it to 4:5 here.
    let image = await fetchSceneImage(prompt, hashSeed(`${storyId}-video-${i}`),
      genre === 'devotional' ? { width: 1024, height: 1024 } : undefined);
    if (!image) {
      // Never drop a scene outright: unlike the carousel (each slide stands
      // alone), these scenes are concatenated back to back against a fixed
      // narration track — skipping one shrinks the video below the audio's
      // real length, so ffmpeg's `-shortest` cuts the narration off early.
      // A local themed card (no network call, can't fail) keeps every
      // slot filled and the full narration playing, even in the rare case
      // both image providers are down for this one scene.
      image = await renderFallbackCover(genre, { width: 1080, height: 1350 });
    }
    const file = path.join(outDir, `video-scene-${i + 1}.jpg`);
    fs.writeFileSync(file, image);
    scenes.push({ file, duration: Math.max(1.5, planned[i].end - planned[i].start) });
  }
  return scenes.length ? scenes : null;
}

module.exports = { buildVideoScenes };
