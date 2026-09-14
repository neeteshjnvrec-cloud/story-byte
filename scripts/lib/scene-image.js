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

/** Fetches one bespoke scene illustration. Never throws — callers fall back
 *  to a themed gradient card / equal-timing slide when this returns null.
 *
 *  A single long story can need a dozen-plus of these back to back (carousel
 *  slides + video scenes both draw from the same free, unauthenticated API),
 *  which is enough to trip pollinations.ai's burst rate limit (HTTP 429) —
 *  observed in production wiping out every single fetch for one story.
 *  429 specifically means "try again shortly", so it gets a couple of
 *  backoff retries; any other failure (timeout, 5xx, truncated response)
 *  fails fast as before. */
async function fetchSceneImage(prompt, seed, { width = 1080, height = 1350, timeoutMs = 25000, retries = 2 } = {}) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=flux`;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 429 && attempt < retries) {
        clearTimeout(timer);
        await sleep(3000 * (attempt + 1));
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
