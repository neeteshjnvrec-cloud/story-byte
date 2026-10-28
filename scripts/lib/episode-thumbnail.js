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

module.exports = { renderEpisodeThumbnail, THUMB_WIDTH: W, THUMB_HEIGHT: H };
