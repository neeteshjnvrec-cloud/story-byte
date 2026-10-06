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
async function fetchCloudflareImage(prompt, { timeoutMs = 45000, retries = 3, steps } = {}) {
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
        // steps: Flux-schnell defaults to 4 and accepts up to 8 — more
        // detail per image at roughly double the (free) neuron cost.
        body: JSON.stringify(steps ? { prompt, steps } : { prompt }),
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

// FLUX.2 [klein] 4B: much more detailed and lifelike than flux-1-schnell,
// renders the requested size natively (256-1920px a side) instead of a
// 1024x1024 square that then had to be cropped and blown up ~1.9x for a
// 9:16 Short (the soft, smeary look of the first daily videos), and can
// take up to 4 reference images (each under 512x512) to keep a character
// looking the same from scene to scene. ~26 neurons per 512x512 output
// tile, so a 864x1536 portrait (6 tiles) is ~160 of the free 10,000/day.
const HQ_MODEL = process.env.CLOUDFLARE_HQ_MODEL || '@cf/black-forest-labs/flux-2-klein-4b';

/** Fetches one image from the HQ model at `width` x `height` (multiples of
 *  16), optionally guided by `refs` (JPEG/PNG Buffers, each under 512x512).
 *  Returns a Buffer or throws — callers fall back to fetchCloudflareImage. */
async function fetchCloudflareHQImage(prompt, { width, height, refs = [], timeoutMs = 90000, retries = 2 } = {}) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) throw new Error('CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN not configured');
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${HQ_MODEL}`;

  for (let attempt = 0; ; attempt++) {
    // The model only takes multipart form data, even for a bare prompt.
    // fetch sets the multipart Content-Type (with its boundary) itself.
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('width', String(width));
    form.append('height', String(height));
    refs.slice(0, 4).forEach((buf, i) => form.append(`input_image_${i}`, new Blob([buf], { type: 'image/jpeg' }), `ref-${i}.jpg`));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` }, body: form, signal: controller.signal });
      if (res.status >= 500 && attempt < retries) { await sleep(Math.min(2000 * 2 ** attempt, 20000)); continue; }
      const json = await res.json().catch(() => ({}));
      // 429 here is usually the free daily allocation running out — not
      // worth waiting on; the caller drops to the cheaper model instead.
      if (!res.ok || !json.success || !json.result?.image) {
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(json.errors || json).slice(0, 200)}`);
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

module.exports = { fetchCloudflareImage, fetchCloudflareHQImage };
