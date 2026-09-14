/**
 * Shared bespoke-scene-illustration fetcher (pollinations.ai) — used by both
 * the carousel slide renderer and the narrated-video scene renderer so the
 * image-generation strategy (model, sizing, timeout, seeding, rate-limit
 * handling) doesn't drift between the two.
 */
function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Pollinations' anonymous tier is paced at one request per 15s — a burst of
// back-to-back retries (what an earlier version of this file did: a couple
// of seconds of backoff on 429) never gets ahead of that, it just re-trips
// the same limiter. A single story needs a dozen-plus of these (carousel
// slides + video scenes both draw from it), so every call — across every
// caller, sequential or not — is paced through this one module-level gate
// instead of firing whenever its caller happens to be ready.
const MIN_INTERVAL_MS = 16000;
let nextSlotAt = 0;

async function waitForSlot() {
  const wait = nextSlotAt - Date.now();
  nextSlotAt = Math.max(nextSlotAt, Date.now()) + MIN_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

/** Fetches one bespoke scene illustration. Never throws — callers fall back
 *  to a themed gradient card / equal-timing slide when this returns null. */
async function fetchSceneImage(prompt, seed, { width = 1080, height = 1350, timeoutMs = 25000, retries = 1 } = {}) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=flux`;

  for (let attempt = 0; ; attempt++) {
    await waitForSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 429 && attempt < retries) {
        clearTimeout(timer);
        continue;
      }
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
}

module.exports = { fetchSceneImage, hashSeed };
