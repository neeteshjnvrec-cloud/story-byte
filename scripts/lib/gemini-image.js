/**
 * Gemini API image generation — an automatic fallback for when
 * pollinations.ai fails (see lib/scene-image.js), since pollinations has
 * shown real multi-hour outages in production.
 *
 * NOTE: as of a December 2025 policy change, Gemini's image models are
 * NOT covered by a no-billing-required free tier the way Gemini's text
 * models are — a project with no billing linked gets a hard quota of 0
 * for every image model (confirmed directly against the live API: every
 * image-capable model returns 429 RESOURCE_EXHAUSTED, limit: 0). Billing
 * must be enabled on the Google Cloud project for this to work at all;
 * see GEMINI-SETUP.md. Usage-based cost is small (~$0.04/image as of
 * writing) and only applies when pollinations actually fails, since this
 * is a fallback, not the primary provider.
 *
 * Optional by design: with no GEMINI_API_KEY configured, this throws
 * immediately so the caller's fallback chain (pollinations -> Gemini ->
 * local themed card) just skips straight past it.
 */

// Same fallback-chain pattern as the Groq model lists elsewhere in this
// pipeline (build-stories.js, carousel-copy.js, video-scenes.js) — Google
// renames/retires image model ids over time, so trying a short list beats
// hardcoding one that might already be stale. Verified against the live
// ListModels response for these three (all support generateContent);
// gemini-2.0-flash-preview-image-generation, an earlier guess, does not
// exist in the current catalog and was dropped.
const MODELS = (process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image,gemini-3.1-flash-image,gemini-3.1-flash-lite-image')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Fetches one image from Gemini and returns it as a Buffer, or throws
 *  with every attempted model's own failure reason (not just the last),
 *  since a 404 on a later model previously hid the real 429 quota error
 *  on the first. */
async function fetchGeminiImage(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const errors = [];
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = await res.json();
      const parts = json?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData?.data);
      if (!imagePart) throw new Error('no image in response');
      return Buffer.from(imagePart.inlineData.data, 'base64');
    } catch (e) {
      errors.push(`${model}: ${e.message}`);
    }
  }
  throw new Error(errors.join(' | ') || 'all Gemini image models failed');
}

module.exports = { fetchGeminiImage };
