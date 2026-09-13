/**
 * Instagram carousel slide renderer.
 *
 * Turns a story into a set of on-brand 1080x1350 JPEGs that read as one
 * connected teaser, not a random blob of screenshots. There's no separate
 * "title card" — every slide already carries the story's own art and a
 * shared eyebrow strip, so slide 1 goes straight into the story:
 *   1. the story's real cover art + its opening teaser line,
 *   2..N-1. each a bespoke AI-illustrated scene for that beat of the story
 *      (curiosity-driven teaser lines from lib/carousel-copy — never the
 *      raw wall of text — falling back to a themed gradient card when no
 *      scene art is available), and
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

const W = 1080;
const H = 1350;

// Genre → gradient/accent (fallback cards) + a mood phrase folded into every
// generated scene image so the art stays visually consistent with the copy.
const GENRE_THEME = {
  romance: { from: '#5c1a3a', to: '#220b16', accent: '#ff8fab', ink: '#2a0b1c', mood: 'warm, golden, tender, intimate' },
  mystery: { from: '#1c2140', to: '#080a16', accent: '#8fa0ff', ink: '#12163a', mood: 'moody, atmospheric, muted tones, fog' },
  drama: { from: '#3a2417', to: '#180d07', accent: '#ffc98b', ink: '#3a2417', mood: 'warm cinematic, earthy tones' },
  fantasy: { from: '#0f3a34', to: '#051815', accent: '#7fe0c0', ink: '#0c2b26', mood: 'magical, glowing, otherworldly' },
  thriller: { from: '#3a1414', to: '#140505', accent: '#ff6f61', ink: '#3a1414', mood: 'tense, shadowy, high-contrast' },
  comedy: { from: '#4a3a00', to: '#1e1700', accent: '#ffd54f', ink: '#4a3a00', mood: 'bright, playful, whimsical' },
  horror: { from: '#181818', to: '#000000', accent: '#c62828', ink: '#ffffff', mood: 'dark, eerie, unsettling shadows' },
  adventure: { from: '#3a2a00', to: '#161000', accent: '#ffb300', ink: '#3a2a00', mood: 'sweeping, sunlit, epic vistas' },
  sleep: { from: '#101a3a', to: '#040713', accent: '#8fa8ff', ink: '#0e1638', mood: 'calm, dreamy nighttime, soft moonlight' },
  motivation: { from: '#3a2900', to: '#161000', accent: '#ff9f1c', ink: '#3a2900', mood: 'bright, uplifting, golden light' },
  devotional: { from: '#3a2f0f', to: '#171205', accent: '#e0b84b', ink: '#3a2f0f', mood: 'serene, warm, sacred glow' },
  'slice-of-life': { from: '#0f3a1a', to: '#051505', accent: '#8bd17c', ink: '#123a1e', mood: 'cozy, everyday, soft natural light' },
  default: { from: '#241a12', to: '#0e0a06', accent: '#c99a5b', ink: '#241a12', mood: 'warm cinematic storybook' },
};

const theme = (genre) => GENRE_THEME[genre] || GENRE_THEME.default;

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SERIF = "Georgia, 'Noto Serif', 'DejaVu Serif', serif";
const SANS = "Helvetica, Arial, 'DejaVu Sans', sans-serif";

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

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

/** Fetches a bespoke scene illustration for one teaser beat. Never throws —
 *  a slide simply falls back to a themed gradient card if this fails. */
async function fetchSceneImage(prompt, seed, { timeoutMs = 25000 } = {}) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${W}&height=${H}&nologo=true&seed=${seed}&model=flux`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2048) throw new Error('response too small');
    return buf;
  } catch (e) {
    console.warn(`    ⚠️  Scene image fetch failed ("${prompt.slice(0, 50)}…"): ${e.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
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
    if (i === 0) {
      // Slide 1 always uses the story's own cover art — already generated,
      // guaranteed to exist locally, no network round-trip needed.
      try {
        bg = await fs.promises.readFile(coverPath);
      } catch {
        bg = null;
      }
    } else if (teaser.image) {
      const prompt = `${teaser.image}. ${t.mood}, painterly storybook illustration, cinematic lighting, no text, no words`;
      bg = await fetchSceneImage(prompt, hashSeed(`${storyId}-${i}`));
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

module.exports = { buildCarouselSlides };
