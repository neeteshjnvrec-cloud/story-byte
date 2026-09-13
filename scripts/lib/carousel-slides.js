/**
 * Instagram carousel slide renderer.
 *
 * Turns a story into a set of on-brand 1080x1350 JPEGs that read as one
 * connected teaser, not a random blob of screenshots:
 *   1. a cover slide — cover art, title, and a one-line curiosity hook,
 *   2..N. quote-card slides that walk the story's arc (curiosity-driven
 *      teaser lines from lib/carousel-copy, never the raw wall of text),
 *      each carrying the story's name + a page counter for context, and
 *   N+1. a "play the story" CTA slide with the cover thumbnail.
 *
 * Every slide shares the same top eyebrow strip and bottom branding so the
 * carousel reads as a single designed piece when swiped through.
 *
 * Pure image compositing (sharp + inline SVG, base64-embedded raster where a
 * photo needs to sit inside a rounded/clipped shape) — no headless browser,
 * so it runs on a bare GitHub Actions runner with no extra system deps.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { buildCarouselCopy } = require('./carousel-copy');

const W = 1080;
const H = 1350;

// Genre → gradient + accent. Falls back to a warm neutral for anything
// unmapped. `ink` is the text color that reads on top of `accent`.
const GENRE_THEME = {
  romance: { from: '#5c1a3a', to: '#220b16', accent: '#ff8fab', ink: '#2a0b1c' },
  mystery: { from: '#1c2140', to: '#080a16', accent: '#8fa0ff', ink: '#12163a' },
  drama: { from: '#3a2417', to: '#180d07', accent: '#ffc98b', ink: '#3a2417' },
  fantasy: { from: '#0f3a34', to: '#051815', accent: '#7fe0c0', ink: '#0c2b26' },
  thriller: { from: '#3a1414', to: '#140505', accent: '#ff6f61', ink: '#3a1414' },
  comedy: { from: '#4a3a00', to: '#1e1700', accent: '#ffd54f', ink: '#4a3a00' },
  horror: { from: '#181818', to: '#000000', accent: '#c62828', ink: '#ffffff' },
  adventure: { from: '#3a2a00', to: '#161000', accent: '#ffb300', ink: '#3a2a00' },
  sleep: { from: '#101a3a', to: '#040713', accent: '#8fa8ff', ink: '#0e1638' },
  motivation: { from: '#3a2900', to: '#161000', accent: '#ff9f1c', ink: '#3a2900' },
  devotional: { from: '#3a2f0f', to: '#171205', accent: '#e0b84b', ink: '#3a2f0f' },
  'slice-of-life': { from: '#0f3a1a', to: '#051505', accent: '#8bd17c', ink: '#123a1e' },
  default: { from: '#241a12', to: '#0e0a06', accent: '#c99a5b', ink: '#241a12' },
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

/** The strip every slide shares: brand mark + genre, so a swipe through the
 *  carousel reads as one piece instead of unrelated screenshots. */
function eyebrow({ label, right, accent }) {
  return `
    <text x="64" y="96" font-family="${SANS}" font-weight="700" font-size="26" letter-spacing="3" fill="${accent}">STORYBYTE</text>
    <text x="64" y="130" font-family="${SANS}" font-size="24" fill="#ffffff" fill-opacity="0.6">${esc(label)}</text>
    ${right ? `<text x="${W - 64}" y="96" font-family="${SANS}" font-size="26" fill="#ffffff" fill-opacity="0.75" text-anchor="end">${esc(right)}</text>` : ''}
  `;
}

async function rasterize(svg) {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function loadLogoDataUri(size) {
  const logoPath = path.resolve(__dirname, '../../assets/logo.png');
  if (!fs.existsSync(logoPath)) return null;
  const buf = await sharp(logoPath).resize(size, size).png().toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function coverThumbDataUri(coverPath, size) {
  const buf = await sharp(coverPath).resize(size, size, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

/** Slide 1: cover art, title, and the curiosity hook — all on a legibility
 *  panel so it reads cleanly regardless of how busy the AI art is. */
async function renderCoverSlide({ coverPath, title, genre, hook }) {
  const base = await sharp(coverPath).resize(W, H, { fit: 'cover' }).toBuffer();
  const t = theme(genre);
  const genreLabel = (genre || 'story').replace(/-/g, ' ').toUpperCase();
  const titleLines = wrapLines(title || 'A StoryByte story', 21, 3);
  const hookLines = hook ? wrapLines(hook, 38, 2) : [];

  const panelH = 210 + titleLines.length * 62 + hookLines.length * 42;
  const panelY = H - panelH - 64;
  const titleStartY = panelY + 118;
  const hookStartY = titleStartY + titleLines.length * 62 + 46;

  const logo = await loadLogoDataUri(84);

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="45%" stop-color="#000000" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#scrim)"/>
    ${logo ? `<image href="${logo}" x="${W - 128}" y="48" width="64" height="64"/>` : ''}
    <rect x="48" y="${panelY}" width="${W - 96}" height="${panelH}" rx="36" fill="#000000" fill-opacity="0.46"/>
    <rect x="80" y="${panelY + 40}" width="${64 + genreLabel.length * 17}" height="50" rx="25" fill="${t.accent}"/>
    <text x="106" y="${panelY + 74}" font-family="${SANS}" font-size="21" font-weight="700" letter-spacing="2" fill="${t.ink}">${esc(genreLabel)}</text>
    <text font-family="${SERIF}" font-weight="700" font-size="58" fill="#ffffff">
      ${tspans(titleLines, { x: 80, startY: titleStartY, lineHeight: 62 })}
    </text>
    ${hookLines.length ? `<text font-family="${SANS}" font-style="italic" font-size="30" fill="${t.accent}">${tspans(hookLines, { x: 80, startY: hookStartY, lineHeight: 42 })}</text>` : ''}
    <text x="80" y="${panelY + panelH - 34}" font-family="${SANS}" font-size="26" fill="#ffffff" fill-opacity="0.85">🎧 Free full narration — tap the link in bio</text>
  </svg>`;

  const overlay = await rasterize(svg);
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
}

/** Slides 2..N: one curiosity-driven teaser line per card, framed as a card
 *  (not text floating on a gradient) for actual visual weight. */
async function renderQuoteSlide({ title, excerpt, index, total, genre }) {
  const t = theme(genre);
  const lines = wrapLines(excerpt, 25, 7);
  const lineHeight = 56;
  const padY = 84;
  const panelW = W - 144;
  const panelH = lines.length * lineHeight + padY * 2;
  const panelX = 72;
  const panelY = H / 2 - panelH / 2;
  const textStartY = panelY + padY + 40;

  const dotsTotal = total;
  const dotSpacing = 32;
  const dots = Array.from({ length: dotsTotal }, (_, i) => i)
    .map(
      (i) =>
        `<circle cx="${W / 2 - ((dotsTotal - 1) * dotSpacing) / 2 + i * dotSpacing}" cy="${H - 90}" r="${i === index ? 8 : 5}" fill="${i === index ? t.accent : '#ffffff'}" fill-opacity="${i === index ? 1 : 0.32}"/>`
    )
    .join('');

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${t.from}"/>
        <stop offset="100%" stop-color="${t.to}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="${W + 60}" cy="80" r="260" fill="${t.accent}" fill-opacity="0.09"/>
    <circle cx="-80" cy="${H - 120}" r="300" fill="${t.accent}" fill-opacity="0.08"/>
    ${eyebrow({ label: (title || '').slice(0, 34), right: `${index + 1} / ${total}`, accent: t.accent })}
    <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="28" fill="#ffffff" fill-opacity="0.07" stroke="${t.accent}" stroke-opacity="0.35" stroke-width="1.5"/>
    <text x="${panelX + 40}" y="${panelY + 66}" font-family="${SERIF}" font-size="90" fill="${t.accent}" fill-opacity="0.55">“</text>
    <text font-family="${SERIF}" font-size="42" fill="#ffffff" text-anchor="middle">
      ${tspans(lines, { x: W / 2, startY: textStartY, lineHeight })}
    </text>
    ${dots}
  </svg>`;

  const layer = await rasterize(svg);
  return sharp({ create: { width: W, height: H, channels: 4, background: t.to } })
    .composite([{ input: layer, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

/** Final slide: the cover thumbnail + a clear "go listen" call to action. */
async function renderCtaSlide({ title, hook, genre, coverPath }) {
  const t = theme(genre);
  const thumbSize = 420;
  const thumbX = (W - thumbSize) / 2;
  const thumbY = 220;
  const titleLines = wrapLines(title || 'Keep listening', 24, 2);
  const hookLines = hook ? wrapLines(hook, 40, 2) : [];
  let y = thumbY + thumbSize + 100;
  const titleStartY = y;
  y += titleLines.length * 56 + 20;
  const hookStartY = y;
  y += hookLines.length * 40 + 70;
  const pillY = y;

  const thumb = await coverThumbDataUri(coverPath, thumbSize);

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${t.from}"/>
        <stop offset="100%" stop-color="${t.to}"/>
      </linearGradient>
      <clipPath id="thumbClip">
        <rect x="${thumbX}" y="${thumbY}" width="${thumbSize}" height="${thumbSize}" rx="32"/>
      </clipPath>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${eyebrow({ label: (genre || 'story').toUpperCase(), accent: t.accent })}
    <rect x="${thumbX - 6}" y="${thumbY - 6}" width="${thumbSize + 12}" height="${thumbSize + 12}" rx="36" fill="${t.accent}" fill-opacity="0.55"/>
    <image href="${thumb}" x="${thumbX}" y="${thumbY}" width="${thumbSize}" height="${thumbSize}" clip-path="url(#thumbClip)" preserveAspectRatio="xMidYMid slice"/>
    <text font-family="${SERIF}" font-weight="700" font-size="52" fill="#ffffff" text-anchor="middle">
      ${tspans(titleLines, { x: W / 2, startY: titleStartY, lineHeight: 56 })}
    </text>
    ${hookLines.length ? `<text font-family="${SANS}" font-size="30" fill="#ffffff" fill-opacity="0.82" text-anchor="middle">${tspans(hookLines, { x: W / 2, startY: hookStartY, lineHeight: 40 })}</text>` : ''}
    <rect x="${W / 2 - 230}" y="${pillY}" width="460" height="96" rx="48" fill="${t.accent}"/>
    <text x="${W / 2}" y="${pillY + 62}" font-family="${SANS}" font-weight="700" font-size="34" fill="${t.ink}" text-anchor="middle">▶ Play the full story</text>
    <text x="${W / 2}" y="${pillY + 148}" font-family="${SANS}" font-size="24" fill="#ffffff" fill-opacity="0.65" text-anchor="middle">Free · Full narration · Link in bio</text>
  </svg>`;

  const layer = await rasterize(svg);
  return sharp({ create: { width: W, height: H, channels: 4, background: t.to } })
    .composite([{ input: layer, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Renders the full carousel for a story and writes JPEGs to `outDir`.
 * Returns `{ urls, hook }` — `urls` in post order (5-8 slides), `hook` the
 * curiosity tagline also worth reusing in the Instagram caption.
 */
async function buildCarouselSlides({ storyId, title, text, genre, description, coverPath, outDir, siteUrl }) {
  fs.mkdirSync(outDir, { recursive: true });

  const { hook, slides: teasers } = await buildCarouselCopy({ title, text, genre, description });

  const slides = [];
  slides.push(await renderCoverSlide({ coverPath, title, genre, hook }));
  for (let i = 0; i < teasers.length; i++) {
    slides.push(await renderQuoteSlide({ title, excerpt: teasers[i], index: i, total: teasers.length, genre }));
  }
  slides.push(await renderCtaSlide({ title, hook, genre, coverPath }));

  const urls = [];
  for (let i = 0; i < slides.length; i++) {
    const file = path.join(outDir, `slide-${i + 1}.jpg`);
    fs.writeFileSync(file, slides[i]);
    urls.push(`${siteUrl}/instagram/${storyId}/slide-${i + 1}.jpg`);
  }
  return { urls, hook };
}

module.exports = { buildCarouselSlides };
