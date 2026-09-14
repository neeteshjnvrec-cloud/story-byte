/**
 * Shared bespoke-scene-illustration fetcher (pollinations.ai) — used by both
 * the carousel slide renderer and the narrated-video scene renderer so the
 * image-generation strategy (model, sizing, timeout, seeding) doesn't drift
 * between the two.
 */
function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

/** Fetches one bespoke scene illustration. Never throws — callers fall back
 *  to a themed gradient card / equal-timing slide when this returns null. */
async function fetchSceneImage(prompt, seed, { width = 1080, height = 1350, timeoutMs = 25000 } = {}) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=flux`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2048) throw new Error('response too small');
    return buf;
  } catch (e) {
    console.warn(`    ⚠️  Scene image fetch failed ("${prompt.slice(0, 50)}…"): ${e.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchSceneImage, hashSeed };
