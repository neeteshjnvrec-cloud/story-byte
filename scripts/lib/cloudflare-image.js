/**
 * Cloudflare Workers AI image generation — an automatic fallback for when
 * pollinations.ai fails (see lib/scene-image.js), since pollinations has
 * shown real multi-hour outages in production.
 *
 * Unlike Gemini (which turned out to require billing enabled for image
 * models specifically as of a December 2025 policy change — confirmed
 * directly against the live API), Workers AI's free allocation (10,000
 * "neurons"/day, resetting daily) genuinely requires no card on file, and
 * a Flux-1-schnell image costs under 10 neurons — over 1,000 free
 * images/day, verified working end to end with a real account before this
 * was wired in.
 *
 * Optional by design: with no CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN
 * configured, this throws immediately so the caller's fallback chain
 * (pollinations -> Cloudflare -> local themed card) just skips past it.
 */
const MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetches one image from Cloudflare Workers AI and returns it as a
 *  Buffer, or throws. The model has no width/height parameter — it always
 *  returns 1024x1024 — so callers that need a different size resize the
 *  result themselves (see fetchStoryImage in lib/scene-image.js).
 *
 *  Retries a 429/5xx/timeout with exponential backoff (2s, 4s, 8s) instead
 *  of failing on the first blip — a slower render is worth it to not drop
 *  a scene's art. Missing configuration and a genuine 4xx (bad prompt, bad
 *  auth) still fail immediately; those never get fixed by waiting. */
async function fetchCloudflareImage(prompt, { timeoutMs = 45000, retries = 3 } = {}) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) throw new Error('CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN not configured');

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) { await sleep(Math.min(2000 * 2 ** attempt, 20000)); continue; }
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = await res.json();
      if (!json.success || !json.result?.image) {
        throw new Error(`no image in response: ${JSON.stringify(json.errors || json).slice(0, 200)}`);
      }
      return Buffer.from(json.result.image, 'base64');
    } catch (e) {
      if (e.name === 'AbortError' && attempt < retries) { await sleep(Math.min(2000 * 2 ** attempt, 20000)); continue; }
      throw e.name === 'AbortError' ? new Error(`timed out after ${timeoutMs / 1000}s`) : e;
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { fetchCloudflareImage };
