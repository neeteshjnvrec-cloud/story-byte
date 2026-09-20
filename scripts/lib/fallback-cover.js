/**
 * A pure-local (no network) fallback cover — a themed gradient card in the
 * same palette used elsewhere for a story's genre — for when
 * pollinations.ai's cover fetch fails outright (confirmed in production as
 * a genuine multi-minute outage on their end, not something client-side
 * retries can paper over).
 *
 * Unlike the carousel/video scene art (which already degrades gracefully
 * to a themed card when pollinations fails), the cover previously had no
 * such fallback — any pollinations outage aborted the whole story, even
 * though the actual content (text + narration) generated fine. Never
 * throws: pure local image compositing, no network call to fail.
 */
const sharp = require('sharp');
const { theme } = require('./genre-theme');

async function renderFallbackCover(genre, { width = 768, height = 768 } = {}) {
  const t = theme(genre);
  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${t.from}"/>
        <stop offset="100%" stop-color="${t.to}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="${width * 0.85}" cy="${height * 0.12}" r="${width * 0.28}" fill="${t.accent}" fill-opacity="0.14"/>
    <circle cx="${width * 0.1}" cy="${height * 0.92}" r="${width * 0.32}" fill="${t.accent}" fill-opacity="0.1"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

module.exports = { renderFallbackCover };
