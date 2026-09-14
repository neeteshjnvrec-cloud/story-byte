/**
 * Shared pollinations.ai image fetcher — used for the story cover AND both
 * the carousel slide renderer and the narrated-video scene renderer, so the
 * image-generation strategy (auth, pacing, sizing, timeout, seeding) is one
 * implementation instead of three.
 */
function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Free registration at auth.pollinations.ai gets a Bearer token that lifts
// the anonymous tier's 1-request/15s pace to 1-request/5s ("seed" tier) —
// see POLLINATIONS-SETUP.md. Optional: everything here still works
// anonymously (just slower/more timeout-prone) when this isn't set.
const POLLINATIONS_TOKEN = process.env.POLLINATIONS_API_TOKEN || null;

// A burst of back-to-back retries (what an earlier version of this file
// did: a couple of seconds of backoff on 429) never gets ahead of
// pollinations' own per-tier pace limit, it just re-trips it on the next
// call. A single story needs a dozen-plus of these (cover + carousel
// slides + video scenes all draw from it), so every call — across every
// caller, sequential or not — is paced through this one module-level gate
// instead of firing whenever its caller happens to be ready.
const MIN_INTERVAL_MS = POLLINATIONS_TOKEN ? 5500 : 16000;
let nextSlotAt = 0;

async function waitForSlot() {
  const wait = nextSlotAt - Date.now();
  nextSlotAt = Math.max(nextSlotAt, Date.now()) + MIN_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

/**
 * Fetches one pollinations.ai image and returns it as a Buffer, or throws.
 * Paced through the shared gate above and authenticated when a token is
 * configured. Timeouts get the same one-retry treatment as a 429 instead of
 * failing on the first slow response — under load, pollinations' free flux
 * tier routinely takes longer than a quick call allows to render at
 * 1080x1350, observed in production as a string of consecutive client-side
 * timeouts once request pacing on its own was already fixed.
 */
async function fetchPollinationsImage(prompt, seed, { width = 1080, height = 1350, timeoutMs = 45000, retries = 1 } = {}) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=flux`;
  const headers = POLLINATIONS_TOKEN ? { Authorization: `Bearer ${POLLINATIONS_TOKEN}` } : undefined;

  for (let attempt = 0; ; attempt++) {
    await waitForSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers });
      if (res.status === 429) {
        if (attempt < retries) continue;
        throw new Error('HTTP 429');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2048) throw new Error('response too small');
      return buf;
    } catch (e) {
      if (e.name === 'AbortError' && attempt < retries) continue;
      throw e.name === 'AbortError' ? new Error(`timed out after ${timeoutMs / 1000}s`) : e;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Fetches one bespoke scene illustration. Never throws — callers fall back
 *  to a themed gradient card / equal-timing slide when this returns null. */
async function fetchSceneImage(prompt, seed, opts = {}) {
  try {
    return await fetchPollinationsImage(prompt, seed, opts);
  } catch (e) {
    console.warn(`    ⚠️  Scene image fetch failed ("${prompt.slice(0, 50)}…"): ${e.message}`);
    return null;
  }
}

module.exports = { fetchSceneImage, fetchPollinationsImage, hashSeed };
