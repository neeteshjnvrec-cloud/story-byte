/**
 * Instagram carousel slide renderer.
 *
 * Turns a story (cover image + text) into a set of on-brand 1080x1350 JPEGs:
 *   1. a cover slide (the AI cover art with title + genre overlay),
 *   2..N. quote-card slides that walk through the story's arc (evenly
 *      sampled paragraphs, not the raw wall of text — a carousel is skimmed,
 *      not read), and
 *   N+1. a "keep listening" CTA slide pointing at the app.
 *
 * Pure image compositing (sharp + inline SVG) — no headless browser, so it
 * runs on a bare GitHub Actions runner with no extra system deps.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const W = 1080;
const H = 1350;
const MAX_BODY_SLIDES = 5;

// Genre → gradient. Falls back to a warm neutral for anything unmapped.
const GENRE_THEME = {
  romance: { from: '#5c1a3a', to: '#2a0b1c', accent: '#ff8fab' },
  mystery: { from: '#1c2140', to: '#0a0c1a', accent: '#8fa0ff' },
  drama: { from: '#3a2417', to: '#1a0f08', accent: '#ffc98b' },
  fantasy: { from: '#0f3a34', to: '#061a17', accent: '#7fe0c0' },
  thriller: { from: '#3a1414', to: '#170707', accent: '#ff6f61' },
  comedy: { from: '#4a3a00', to: '#231b00', accent: '#ffd54f' },
  horror: { from: '#141414', to: '#000000', accent: '#c62828' },
  adventure: { from: '#3a2a00', to: '#1a1200', accent: '#ffb300' },
  sleep: { from: '#101a3a', to: '#050815', accent: '#8fa8ff' },
  motivation: { from: '#3a2900', to: '#1a1200', accent: '#ff9f1c' },
  devotional: { from: '#3a2f0f', to: '#1a1506', accent: '#e0b84b' },
  'slice-of-life': { from: '#0f3a1a', to: '#06170a', accent: '#8bd17c' },
  default: { from: '#241a12', to: '#100b07', accent: '#c99a5b' },
};

const theme = (genre) => GENRE_THEME[genre] || GENRE_THEME.default;

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SERIF = "Georgia, 'Noto Serif', 'DejaVu Serif', serif";
const SANS = "Helvetica, Arial, 'DejaVu Sans', sans-serif";

/** Greedy word-wrap by estimated character width, capped at maxLines. */
function wrapLines(text, maxChars, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = next;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  const consumed = lines.join(' ').length;
  if (consumed < words.join(' ').length) {
    const last = lines[lines.length - 1] || '';
    lines[lines.length - 1] = last.replace(/[.,;:\s]+$/, '') + '…';
  }
  return lines;
}

function tspans(lines, { x, startY, lineHeight }) {
  return lines
    .map((l, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${esc(l)}</tspan>`)
    .join('');
}

async function svgToBuffer(svg) {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function loadLogoBuffer(size) {
  const logoPath = path.resolve(__dirname, '../../assets/logo.png');
  if (!fs.existsSync(logoPath)) return null;
  return sharp(logoPath).resize(size, size).png().toBuffer();
}

/** Slide 1: the AI cover art with a bottom scrim, title and genre pill. */
async function renderCoverSlide({ coverPath, title, genre }) {
  const base = await sharp(coverPath).resize(W, H, { fit: 'cover' }).toBuffer();
  const titleLines = wrapLines(title || 'A StoryByte story', 22, 3);
  const genreLabel = (genre || 'story').replace(/-/g, ' ').toUpperCase();

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="55%" stop-color="#000000" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.88"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#scrim)"/>
    <rect x="64" y="${H - 420}" width="${64 + genreLabel.length * 17}" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="90" y="${H - 384}" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="2" fill="#ffffff">${esc(genreLabel)}</text>
    <text font-family="${SERIF}" font-weight="700" font-size="64" fill="#ffffff">
      ${tspans(titleLines, { x: 64, startY: H - 280, lineHeight: 72 })}
    </text>
    <text x="64" y="${H - 72}" font-family="${SANS}" font-size="30" fill="#ffffff" fill-opacity="0.92">🎧 Audio story — free on StoryByte</text>
  </svg>`;

  const overlay = await svgToBuffer(svg);
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer();
}

/** Slides 2..N: quote cards that carry the story's arc. */
async function renderQuoteSlide({ excerpt, index, total, genre, logo }) {
  const t = theme(genre);
  const lines = wrapLines(excerpt, 26, 8);
  const blockHeight = lines.length * 58;
  const startY = H / 2 - blockHeight / 2 + 20;
  const dots = Array.from({ length: total }, (_, i) => i)
    .map((i) => `<circle cx="${W / 2 - (total - 1) * 16 + i * 32}" cy="${H - 96}" r="${i === index ? 8 : 5}" fill="${i === index ? t.accent : '#ffffff'}" fill-opacity="${i === index ? 1 : 0.35}"/>`)
    .join('');

  const composites = [];
  if (logo) composites.push({ input: logo, left: W - 128, top: H - 128 });

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${t.from}"/>
        <stop offset="100%" stop-color="${t.to}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="${W - 120}" cy="140" r="220" fill="${t.accent}" fill-opacity="0.10"/>
    <circle cx="120" cy="${H - 200}" r="260" fill="${t.accent}" fill-opacity="0.08"/>
    <text x="120" y="260" font-family="${SERIF}" font-size="140" fill="${t.accent}" fill-opacity="0.55">“</text>
    <text font-family="${SERIF}" font-size="46" fill="#ffffff" text-anchor="middle">
      ${tspans(lines, { x: W / 2, startY, lineHeight: 58 })}
    </text>
    ${dots}
  </svg>`;

  const layer = await svgToBuffer(svg);
  composites.unshift({ input: layer, top: 0, left: 0 });
  return sharp({ create: { width: W, height: H, channels: 4, background: t.to } })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** Final slide: call to action back to the app. */
async function renderCtaSlide({ genre, logo }) {
  const t = theme(genre);
  const composites = [];
  if (logo) composites.push({ input: logo, left: W / 2 - 80, top: 320 });

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${t.from}"/>
        <stop offset="100%" stop-color="${t.to}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <text x="${W / 2}" y="640" font-family="${SERIF}" font-weight="700" font-size="58" fill="#ffffff" text-anchor="middle">The story continues…</text>
    <text x="${W / 2}" y="720" font-family="${SANS}" font-size="34" fill="#ffffff" fill-opacity="0.85" text-anchor="middle">Full narration, free, on StoryByte</text>
    <rect x="${W / 2 - 190}" y="800" width="380" height="90" rx="45" fill="${t.accent}"/>
    <text x="${W / 2}" y="857" font-family="${SANS}" font-weight="700" font-size="34" fill="#1a1206" text-anchor="middle">Link in bio</text>
  </svg>`;

  const layer = await svgToBuffer(svg);
  composites.unshift({ input: layer, top: 0, left: 0 });
  return sharp({ create: { width: W, height: H, channels: 4, background: t.to } })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** Evenly sample up to `count` paragraphs across the full story so the
 *  carousel reads as a beginning → middle → end arc instead of one blob. */
function sampleParagraphs(text, count) {
  const paras = String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length <= count) return paras;

  const picked = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (paras.length - 1)) / (count - 1));
    picked.push(paras[idx]);
  }
  return picked;
}

/**
 * Renders the full carousel for a story and writes JPEGs to `outDir`.
 * Returns the list of public URLs (relative to `siteUrl`) in post order.
 */
async function buildCarouselSlides({ storyId, title, text, genre, coverPath, outDir, siteUrl }) {
  fs.mkdirSync(outDir, { recursive: true });
  const logo = await loadLogoBuffer(96);

  const excerpts = sampleParagraphs(text, MAX_BODY_SLIDES);
  const slides = [];

  slides.push(await renderCoverSlide({ coverPath, title, genre }));
  for (let i = 0; i < excerpts.length; i++) {
    slides.push(
      await renderQuoteSlide({ excerpt: excerpts[i], index: i, total: excerpts.length, genre, logo })
    );
  }
  slides.push(await renderCtaSlide({ genre, logo }));

  const urls = [];
  for (let i = 0; i < slides.length; i++) {
    const file = path.join(outDir, `slide-${i + 1}.jpg`);
    fs.writeFileSync(file, slides[i]);
    urls.push(`${siteUrl}/instagram/${storyId}/slide-${i + 1}.jpg`);
  }
  return urls;
}

module.exports = { buildCarouselSlides };
