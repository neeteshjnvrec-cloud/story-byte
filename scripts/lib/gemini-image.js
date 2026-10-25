/**
 * One picture from Google's Gemini image model ("Nano Banana",
 * GEMINI_IMAGE_MODEL, default gemini-2.5-flash-image) with GEMINI_API_KEY.
 * Far better than Cloudflare's FLUX.2 at faces, hands and ornaments, so it
 * draws the deity reference portraits (scripts/deity-portraits.js). Returns a
 * JPEG Buffer or throws — e.g. when the key's plan has no image quota.
 */
const sharp = require('sharp');

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

async function fetchGeminiImage(prompt, { aspectRatio = '3:4', timeoutMs = 120000 } = {}) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
      }),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Gemini image ${res.status}: ${JSON.stringify(json.error || json).slice(0, 200)}`);
    const part = (json.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
    if (!part) throw new Error(`Gemini image: no picture in the reply (${json.candidates?.[0]?.finishReason || 'no reason given'})`);
    return sharp(Buffer.from(part.inlineData.data, 'base64')).jpeg({ quality: 95 }).toBuffer();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchGeminiImage };
