/**
 * YouTube/Facebook thumbnail for a landscape episode: 1280x720 (YouTube's
 * recommended size, well under its 2MB limit as a JPEG), key art on the
 * right, and on a dark gradient on the left the series title, an
 * "SEASON S · EP N" badge and the episode's own title.
 */
const sharp = require('sharp');
const { wrapLines, tspans } = require('./carousel-slides');

const W = 1280;
const H = 720;
const FONT = "'Noto Sans Devanagari', 'Lohit Devanagari', 'DejaVu Sans', sans-serif";

async function renderEpisodeThumbnail({ art, seriesTitle, season = '1', episode, episodeTitle, accent = '#ffd54f', badge: badgeText, brand = 'StoryByte' }) {
  const base = await sharp(art).resize(W, H, { fit: 'cover', position: 'attention' }).toBuffer();

  const titleLines = wrapLines(String(seriesTitle || '').toUpperCase(), 16, 3);
  const titleSize = titleLines.length > 2 ? 78 : 92;
  const titleLh = Math.round(titleSize * 1.08);
  const subLines = episodeTitle ? wrapLines(episodeTitle, 34, 2) : [];
  const badgeY = 64;
  const badge = badgeText || `SEASON ${season} · EP ${episode}`;
  const badgeW = 60 + badge.length * 25;
  const titleY = badgeY + 76 + 24 + titleSize * 0.8;
  const subY = titleY + (titleLines.length - 1) * titleLh + 72;

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#000" stop-opacity="0.88"/>
        <stop offset="45%" stop-color="#000" stop-opacity="0.55"/>
        <stop offset="72%" stop-color="#000" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
    <rect x="56" y="${badgeY}" width="${badgeW}" height="76" rx="14" fill="${accent}"/>
    <text x="${56 + badgeW / 2}" y="${badgeY + 53}" font-family="${FONT}" font-weight="800" font-size="42" fill="#111" text-anchor="middle">${badge}</text>
    <text font-family="${FONT}" font-weight="900" font-size="${titleSize}" fill="#fff" stroke="#000" stroke-width="6" paint-order="stroke" letter-spacing="1">
      ${tspans(titleLines, { x: 56, startY: titleY, lineHeight: titleLh })}
    </text>
    ${subLines.length ? `<text font-family="${FONT}" font-weight="700" font-size="40" fill="${accent}" stroke="#000" stroke-width="4" paint-order="stroke">${tspans(subLines, { x: 60, startY: subY, lineHeight: 50 })}</text>` : ''}
    ${brand ? `<text x="60" y="${H - 44}" font-family="${FONT}" font-weight="700" font-size="28" fill="#fff" fill-opacity="0.85">${brand}</text>` : ''}
  </svg>`;

  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
}

const SW = 1080;
const SH = 1920;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A Short's thumbnail: 1080x1920, its picture full-bleed and the title in
 * big type over a dark fade in the lower-middle — clear of the top corners
 * and the bottom ~20%, where YouTube's Shorts shelf draws its own title and
 * view count. `badge` (optional) sits above the title in the accent colour.
 */
async function renderShortThumbnail({ art, title, accent = '#ffd54f', badge, brand = 'StoryByte' }) {
  const base = await sharp(art).resize(SW, SH, { fit: 'cover', position: 'attention' }).toBuffer();

  const lines = wrapLines(String(title || ''), 13, 4);
  const size = lines.length > 3 ? 104 : 120;
  const lh = Math.round(size * 1.15);
  // The title block's bottom stays at ~78% of the height whatever its length.
  const lastY = Math.round(SH * 0.78);
  const firstY = lastY - (lines.length - 1) * lh;
  const badgeH = 76;
  const badgeW = badge ? 60 + [...badge].length * 30 : 0;
  const badgeY = firstY - size - badgeH - 10;

  const svg = `
  <svg width="${SW}" height="${SH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="35%" stop-color="#000" stop-opacity="0"/>
        <stop offset="60%" stop-color="#000" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
    <rect width="${SW}" height="${SH}" fill="url(#fade)"/>
    ${badge ? `<rect x="${(SW - badgeW) / 2}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="14" fill="${accent}"/>
    <text x="${SW / 2}" y="${badgeY + 53}" font-family="${FONT}" font-weight="800" font-size="44" fill="#111" text-anchor="middle">${esc(badge)}</text>` : ''}
    <text font-family="${FONT}" font-weight="900" font-size="${size}" fill="#fff" stroke="#000" stroke-width="8" paint-order="stroke" text-anchor="middle">
      ${tspans(lines, { x: SW / 2, startY: firstY, lineHeight: lh })}
    </text>
    ${brand ? `<text x="${SW / 2}" y="${lastY + 110}" font-family="${FONT}" font-weight="700" font-size="40" fill="${accent}" text-anchor="middle">${esc(brand)}</text>` : ''}
  </svg>`;

  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer();
}

module.exports = { renderEpisodeThumbnail, renderShortThumbnail, THUMB_WIDTH: W, THUMB_HEIGHT: H };
