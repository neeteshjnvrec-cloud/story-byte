/**
 * Cloudflare Workers AI image generation — every story picture comes from
 * here (lib/scene-image.js).
 *
 * Unlike Gemini (which turned out to require billing enabled for image
 * models specifically as of a December 2025 policy change — confirmed
 * directly against the live API), Workers AI's free allocation (10,000
 * "neurons"/day, resetting daily) genuinely requires no card on file, and
 * a Flux-1-schnell image costs under 10 neurons — over 1,000 free
 * images/day, verified working end to end with a real account before this
 * was wired in.
 *
 * Several accounts: each free account has its own 10,000 neurons a day,
 * shared by every model and every workflow that day (a Short's FLUX.2
 * pictures are ~160 each, a Sunday long video ~45 of them). When one
 * account's allocation is used up, the next one carries on — waiting never
 * helps, since it only resets at 00:00 UTC. Accounts, in order:
 *   CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (the original pair), then
 *   CLOUDFLARE_ACCOUNTS: more "accountId:apiToken" pairs, one per line (or
 *   comma-separated).
 */
const MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Every configured account, as [{ id, token }], the original pair first. */
function accounts() {
  const list = [];
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    list.push({ id: process.env.CLOUDFLARE_ACCOUNT_ID.trim(), token: process.env.CLOUDFLARE_API_TOKEN.trim() });
  }
  // Pasted secrets carry invisible characters (a U+2028 line separator from
  // a notes app broke a whole Sunday video): drop every one of them, then
  // split on any whitespace or comma. IDs and tokens never contain spaces.
  const raw = String(process.env.CLOUDFLARE_ACCOUNTS || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
  for (const pair of raw.split(/[\s,;]+/u)) {
    const [id, token] = pair.split(':').map((x) => (x || '').trim());
    if (id && token && !list.some((a) => a.id === id)) list.push({ id, token });
  }
  return list;
}

// Accounts whose free allocation ran out during this run: skipped for the
// rest of it, by every model (the neurons are per account, not per model).
const usedUp = new Set();

/** The daily-allocation error, as opposed to a brief rate limit. */
function isAllocationUsedUp(status, body) {
  return status === 429 && /neuron|allocation|4006|quota/i.test(body || '');
}

/** Runs `attempt(account)` on each account with allocation left, in order,
 *  until one returns an image. Throws with every account's error if none does. */
async function withAccounts(label, attempt) {
  const all = accounts();
  if (!all.length) throw new Error('CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN not configured');
  const errors = [];
  for (const [i, account] of all.entries()) {
    if (usedUp.has(account.id)) continue;
    try {
      return await attempt(account);
    } catch (e) {
      // A flagged picture is about the prompt, not the account: another
      // account would flag it too, and spend its allocation doing so.
      if (e.flagged) throw e;
      if (e.usedUp) {
        usedUp.add(account.id);
        console.warn(`    ⚠️  Cloudflare account ${i + 1}/${all.length}: free daily allocation used up${i + 1 < all.length ? ', trying the next account' : ''}`);
      }
      errors.push(`account ${i + 1}: ${e.message}`);
    }
  }
  if (all.every((a) => usedUp.has(a.id))) errors.push(`all ${all.length} account(s) used up today`);
  throw new Error(`${label}: ${errors.join('; ')}`);
}

/** Cloudflare's safety filter rejected the picture ("output has been flagged"). */
function flaggedError(status, body) {
  const e = new Error(`HTTP ${status}: ${String(body).slice(0, 200)}`);
  e.flagged = /flagged/i.test(String(body));
  return e;
}

function usedUpError(body) {
  const e = new Error(`daily allocation used up: ${String(body).slice(0, 120)}`);
  e.usedUp = true;
  return e;
}

/** Fetches one image from Cloudflare Workers AI and returns it as a
 *  Buffer, or throws. The model has no width/height parameter — it always
 *  returns 1024x1024 — so callers that need a different size resize the
 *  result themselves (see fetchStoryImage in lib/scene-image.js).
 *
 *  A brief 429/5xx/timeout is retried with exponential backoff (2s, 4s, 8s)
 *  on the same account; a used-up daily allocation moves straight to the
 *  next account. A genuine 4xx (bad prompt, bad auth) fails that account. */
function fetchCloudflareImage(prompt, opts = {}) {
  return withAccounts('flux-1-schnell', (account) => fetchCloudflareImageFrom(account, prompt, opts));
}

async function fetchCloudflareImageFrom({ id: accountId, token: apiToken }, prompt, { timeoutMs = 45000, retries = 3, steps } = {}) {
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
        const body = await res.text().catch(() => '');
        if (isAllocationUsedUp(res.status, body)) throw usedUpError(body);
        if (attempt < retries) { await sleep(Math.min(2000 * 2 ** attempt, 20000)); continue; }
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw flaggedError(res.status, body);
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
 *  16), optionally guided by `refs` (JPEG/PNG Buffers, each under 512x512),
 *  from the first account with allocation left. Returns a Buffer or throws —
 *  callers fall back to fetchCloudflareImage. `model` picks another FLUX.2
 *  model with the same inputs, e.g. '@cf/black-forest-labs/flux-2-klein-9b'
 *  (~1,400 neurons a picture: used for one-off reference portraits). */
function fetchCloudflareHQImage(prompt, opts = {}) {
  return withAccounts('FLUX.2', (account) => fetchCloudflareHQImageFrom(account, prompt, opts));
}

async function fetchCloudflareHQImageFrom({ id: accountId, token: apiToken }, prompt, { width, height, refs = [], model = HQ_MODEL, timeoutMs = 90000, retries = 2 } = {}) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

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
      if (isAllocationUsedUp(res.status, JSON.stringify(json))) throw usedUpError(JSON.stringify(json.errors || json));
      if (!res.ok || !json.success || !json.result?.image) {
        throw flaggedError(res.status, JSON.stringify(json.errors || json));
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

module.exports = { fetchCloudflareImage, fetchCloudflareHQImage, accounts };
