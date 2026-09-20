/**
 * Gemini API image generation — an automatic fallback for when
 * pollinations.ai fails (see lib/scene-image.js), since pollinations has
 * shown real multi-hour outages in production. Google's free tier is far
 * more generous (up to 500 requests/day) and needs no artificial pacing
 * the way pollinations' anonymous/seed tiers do.
 *
 * Optional by design: with no GEMINI_API_KEY configured, this throws
 * immediately so the caller's fallback chain (pollinations -> Gemini ->
 * local themed card) just skips straight past it.
 */

// Same fallback-chain pattern as the Groq model lists elsewhere in this
// pipeline (build-stories.js, carousel-copy.js, video-scenes.js) — Google
// renames/retires image model ids over time, so trying a short list beats
// hardcoding one that might already be stale.
const MODELS = (process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image,gemini-2.0-flash-preview-image-generation')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Fetches one image from Gemini and returns it as a Buffer, or throws. */
async function fetchGeminiImage(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  let lastError;
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
        throw new Error(`HTTP ${res.status} (${model}): ${body.slice(0, 200)}`);
      }
      const json = await res.json();
      const parts = json?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData?.data);
      if (!imagePart) throw new Error(`no image in response (${model})`);
      return Buffer.from(imagePart.inlineData.data, 'base64');
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('all Gemini image models failed');
}

module.exports = { fetchGeminiImage };
