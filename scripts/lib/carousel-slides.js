/**
 * Instagram carousel slide renderer.
 *
 * Turns a story into a set of on-brand 1080x1350 JPEGs that read as one
 * connected teaser, not a random blob of screenshots. There's no separate
 * "title card" — every teaser slide (including the first) carries its own
 * bespoke AI-illustrated scene for that beat of the story (curiosity-driven
 * teaser lines + scene descriptions from lib/carousel-copy — never the raw
 * wall of text, and never a generic reused cover), plus a shared eyebrow
 * strip so a swipe through reads as one designed piece:
 *   1..N-1. one illustrated beat per slide, falling back to a themed
 *      gradient card (or, for slide 1 only, the story's own cover art) when
 *      no scene image is available, and
 *   N. a "play the story" CTA slide with the cover thumbnail.
 *
 * Pure image compositing (sharp + inline SVG, base64-embedded raster where a
 * photo needs to sit inside a rounded/clipped shape) — no headless browser,
 * so it runs on a bare GitHub Actions runner with no extra system deps.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { buildCarouselCopy } = require('./carousel-copy');
const { fetchSceneImage, hashSeed } = require('./scene-image');
const { theme } = require('./genre-theme');

const W = 1080;
const H = 1350;

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Devanagari-capable families listed first so Hindi/Marathi copy renders as
// glyphs instead of tofu boxes — the CI runner only ships Latin fonts by
// default (see the workflow's font-install step), so these must actually be
// present, not just named.
const SERIF = "'Noto Serif Devanagari', Georgia, 'Noto Serif', 'DejaVu Serif', serif";
const SANS = "'Noto Sans Devanagari', Helvetica, Arial, 'DejaVu Sans', sans-serif";

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

/** The strip every slide shares: brand mark + story title, so a swipe
 *  through the carousel reads as one piece instead of unrelated screenshots. */
function eyebrow({ label, right, accent }) {
  return `
    <text x="64" y="96" font-family="${SANS}" font-weight="700" font-size="26" letter-spacing="3" fill="${accent}">STORYBYTE</text>
    <text x="64" y="130" font-family="${SANS}" font-size="24" fill="#ffffff" fill-opacity="0.7">${esc(label)}</text>
    ${right ? `<text x="${W - 64}" y="96" font-family="${SANS}" font-size="26" fill="#ffffff" fill-opacity="0.8" text-anchor="end">${esc(right)}</text>` : ''}
  `;
}

function dotsRow(total, index, accent) {
  const spacing = 32;
  return Array.from({ length: total }, (_, i) => i)
    .map(
      (i) =>
        `<circle cx="${W / 2 - ((total - 1) * spacing) / 2 + i * spacing}" cy="${H - 90}" r="${i === index ? 8 : 5}" fill="${i === index ? accent : '#ffffff'}" fill-opacity="${i === index ? 1 : 0.32}"/>`
    )
    .join('');
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

/** A slide with real art behind it — the story's own cover (slide 1) or a
 *  bespoke generated scene (later slides). Text sits on a bottom panel over
 *  a scrim so it stays legible regardless of how busy the art is. */
async function renderArtTeaserSlide({ title, genre, text, hook, index, total, bg }) {
  const t = theme(genre);
  const base = await sharp(bg).resize(W, H, { fit: 'cover' }).toBuffer();
  const logo = await loadLogoDataUri(72);

  const lines = wrapLines(text, 30, 5);
  const lineHeight = 48;
  const hookLines = hook ? wrapLines(hook, 40, 2) : [];
  const hookBlockH = hookLines.length ? hookLines.length * 38 + 28 : 0;
  const padY = 60;
  const panelH = hookBlockH + lines.length * lineHeight + padY * 2;
  const panelY = H - panelH - 96;
  let cursorY = panelY + padY + 4;
  const hookStartY = cursorY + 30;
  cursorY += hookBlockH;
  const textStartY = cursorY + 40;
  const scrimY = panelY - 180;

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="topscrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="botscrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="55%" stop-color="#000000" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.82"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="220" fill="url(#topscrim)"/>
    <rect x="0" y="${scrimY}" width="${W}" height="${H - scrimY}" fill="url(#botscrim)"/>
    ${eyebrow({ label: (title || '').slice(0, 34), right: `${index + 1} / ${total}`, accent: t.accent })}
    ${logo ? `<image href="${logo}" x="${W - 116}" y="44" width="52" height="52" opacity="0.9"/>` : ''}
    ${hookLines.length ? `<text font-family="${SANS}" font-style="italic" font-size="28" fill="${t.accent}">${tspans(hookLines, { x: 80, startY: hookStartY, lineHeight: 38 })}</text>` : ''}
    <text font-family="${SERIF}" font-size="42" fill="#ffffff">
      ${tspans(lines, { x: 80, startY: textStartY, lineHeight })}
    </text>
    ${dotsRow(total, index, t.accent)}
  </svg>`;

  const overlay = await rasterize(svg);
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
}

/** Fallback when no art is available for a beat: a framed quote card on a
 *  themed gradient — still designed, just without bespoke illustration. */
async function renderGradientTeaserSlide({ title, genre, text, hook, index, total }) {
  const t = theme(genre);
  const lines = wrapLines(text, 25, 7);
  const lineHeight = 56;
  const padY = 84;
  const panelW = W - 144;
  const panelH = lines.length * lineHeight + padY * 2;
  const panelX = 72;
  const panelY = H / 2 - panelH / 2;
  const textStartY = panelY + padY + 40;

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
    ${dotsRow(total, index, t.accent)}
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
 * Returns `{ urls, hook }` — `urls` in post order (4-7 slides), `hook` the
 * curiosity tagline also worth reusing in the Instagram caption.
 */
async function buildCarouselSlides({ storyId, title, text, genre, description, coverPath, outDir, siteUrl }) {
  fs.mkdirSync(outDir, { recursive: true });

  const { hook, slides: teasers } = await buildCarouselCopy({ title, text, genre, description });
  const t = theme(genre);

  const slides = [];
  for (let i = 0; i < teasers.length; i++) {
    const teaser = teasers[i];
    let bg = null;
    if (teaser.image) {
      // Every slide, including the first, gets a bespoke illustration for
      // its own beat of the story — not a generic reused cover — so the
      // carousel reads as story-specific art throughout, not a title card
      // followed by an afterthought.
      const prompt = `${teaser.image}. ${t.mood}, painterly storybook illustration, cinematic lighting, no text, no words`;
      bg = await fetchSceneImage(prompt, hashSeed(`${storyId}-${i}`));
    }
    if (!bg && i === 0) {
      // No bespoke art available (Groq off or the fetch failed) — the
      // opening slide still deserves real art over a flat gradient, so fall
      // back to the story's own cover (already generated, no network call).
      try {
        bg = await fs.promises.readFile(coverPath);
      } catch {
        bg = null;
      }
    }

    if (bg) {
      slides.push(
        await renderArtTeaserSlide({
          title, genre, text: teaser.text, hook: i === 0 ? hook : null, index: i, total: teasers.length, bg,
        })
      );
    } else {
      slides.push(
        await renderGradientTeaserSlide({ title, genre, text: teaser.text, index: i, total: teasers.length })
      );
    }
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

module.exports = { buildCarouselSlides, wrapLines, tspans };
