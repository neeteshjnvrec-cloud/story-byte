/**
 * The backup voices, tried in order when Microsoft's free edge-tts voice
 * is unavailable: Gemini (free with GEMINI_API_KEY), then Google Cloud
 * Text-to-Speech (needs the API enabled, with billing, on the Firebase
 * project). Returns { subtitlesPath } or null if none could narrate.
 */
const { synthGemini } = require('./gemini-tts');
const { synthGoogle } = require('./google-tts');

async function synthBackup(text, { out, subsOut, edgeVoice, long = false }) {
  // A 15-minute episode goes to Gemini in ~4,000-character pieces (about 4
  // requests) so it fits the free tier's ~10 requests a day.
  return (await synthGemini(text, { out, subsOut, edgeVoice, ...(long ? { maxChars: 4000 } : {}) })) ||
    (await synthGoogle(text, { out, subsOut, edgeVoice }));
}

module.exports = { synthBackup };
