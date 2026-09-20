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

/** Fetches one image from Cloudflare Workers AI and returns it as a
 *  Buffer, or throws. The model has no width/height parameter — it always
 *  returns 1024x1024 — so callers that need a different size resize the
 *  result themselves (see fetchStoryImage in lib/scene-image.js). */
async function fetchCloudflareImage(prompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) throw new Error('CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN not configured');

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.success || !json.result?.image) {
    throw new Error(`no image in response: ${JSON.stringify(json.errors || json).slice(0, 200)}`);
  }
  return Buffer.from(json.result.image, 'base64');
}

module.exports = { fetchCloudflareImage };
