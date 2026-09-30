/**
 * Bakes each narration-synced caption line directly onto a copy of the
 * scene image active at that moment (sharp + SVG — the same technique the
 * carousel slides use), instead of relying on ffmpeg's `subtitles` filter.
 * That filter, tested against a real concat-demuxer image sequence, turned
 * out to intermittently drop captions on some segments entirely with no
 * error — not something to ship. Baking captions into the frames
 * themselves sidesteps ffmpeg's subtitle-overlay pipeline altogether.
 *
 * Returns the caller's `scenes` unchanged on any failure — captions are a
 * bonus, never a reason to lose the video render.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { wrapLines, tspans } = require('./carousel-slides');

const W = 1080;
const H = 1350;

async function drawCaptionFrame(imagePath, text) {
  const base = await sharp(imagePath).resize(W, H, { fit: 'cover' }).toBuffer();
  const lines = wrapLines(text, 26, 3);
  const lineHeight = 54;
  const padY = 40;
  const panelH = lines.length * lineHeight + padY * 2;
  const panelY = H - panelH - 140;
  const startY = panelY + padY + 40;

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.8"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${panelY - 70}" width="${W}" height="${H - panelY + 70}" fill="url(#scrim)"/>
    <text font-family="'Noto Sans Devanagari', Helvetica, Arial, 'DejaVu Sans', sans-serif" font-weight="700" font-size="44" fill="#ffffff" text-anchor="middle">
      ${tspans(lines, { x: W / 2, startY, lineHeight })}
    </text>
  </svg>`;

  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
}

/**
 * Full-screen 9:16 caption frame for the devotional Shorts: the art is
 * cover-cropped to 1080x1920 around its most salient region (sharp's
 * attention strategy keeps the deity in frame when a square image is cut
 * down to portrait), and the caption sits at `look.captionBottom` — inside
 * the Shorts/Reels safe zone, clear of the title and buttons along the
 * bottom — in the day's caption colour with a heavy outline instead of a
 * dark box.
 */
async function drawShortCaptionFrame(imagePath, text, look = {}) {
  const w = 1080;
  const h = 1920;
  const base = await sharp(imagePath).resize(w, h, { fit: 'cover', position: sharp.strategy.attention }).toBuffer();
  const lines = wrapLines(text, 20, 3);
  const lineHeight = 78;
  const bottom = Math.round(h * (look.captionBottom || 0.7));
  const startY = bottom - (lines.length - 1) * lineHeight;
  const svg = `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="50%" stop-color="#000000" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${startY - lineHeight - 60}" width="${w}" height="${(lines.length + 1) * lineHeight + 120}" fill="url(#scrim)"/>
    <text font-family="'Noto Sans Devanagari', 'Lohit Devanagari', Helvetica, Arial, 'DejaVu Sans', sans-serif" font-weight="800" font-size="64"
      fill="${look.captionColour || '#ffffff'}" stroke="#000000" stroke-width="8" paint-order="stroke" stroke-linejoin="round" text-anchor="middle">
      ${tspans(lines, { x: w / 2, startY, lineHeight })}
    </text>
  </svg>`;
  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 92 }).toBuffer();
}

/**
 * Returns [{ file, duration, sceneIndex, sceneElapsed }] — one baked-caption
 * frame per caption line, using whichever `scenes` background art (the
 * [{ file, duration }] list from lib/video-scenes.js, chronological from
 * t=0) is on screen at that line's midpoint. The final frame's duration is
 * stretched to `audioDurSec` so the video never falls short of the
 * narration and gets its tail clipped by ffmpeg's `-shortest`.
 *
 * A single background scene often spans several caption lines (captions
 * change every line, art doesn't), so multiple frames here can share one
 * `sceneIndex`. `sceneElapsed` — this frame's offset into that shared
 * scene's own timeline, not its own start time — lets lib/video.js render
 * one continuous Ken Burns zoom across all of a scene's caption frames
 * instead of the animation restarting every time the caption text changes.
 *
 * `format: 'short'` draws full-screen 9:16 frames in the day's `look`
 * (drawShortCaptionFrame); otherwise the original 4:5 frames.
 */
async function bakeInCaptions(scenes, captionLines, outDir, audioDurSec, { format, look } = {}) {
  if (!scenes?.length || !captionLines?.length) return scenes;
  try {
    let t = 0;
    const withRange = scenes.map((s, i) => {
      const start = t;
      t += s.duration;
      return { file: s.file, start, end: t, index: i };
    });

    const frames = [];
    for (let i = 0; i < captionLines.length; i++) {
      const line = captionLines[i];
      const mid = (line.start + line.end) / 2;
      const scene = withRange.find((s) => mid >= s.start && mid < s.end) || withRange[withRange.length - 1];
      const buf = format === 'short'
        ? await drawShortCaptionFrame(scene.file, line.text, look)
        : await drawCaptionFrame(scene.file, line.text);
      const file = path.join(outDir, `caption-frame-${i + 1}.jpg`);
      fs.writeFileSync(file, buf);
      const isLast = i === captionLines.length - 1;
      // Frames tile the timeline with no gaps: each runs from its line's
      // start (the first from 0) to the next line's start, so the pauses
      // between sentences stay in the video. Ending each at its own line's
      // end dropped every pause, and over a long story the captions and
      // art drifted seconds ahead of the voice.
      const start = i === 0 ? 0 : line.start;
      const end = isLast ? Math.max(line.end, audioDurSec || line.end) : captionLines[i + 1].start;
      frames.push({
        file,
        duration: Math.max(0.5, end - start),
        sceneIndex: scene.index,
        sceneElapsed: Math.max(0, start - scene.start),
        // Lets lib/video.js spread one camera move over the whole scene.
        sceneDuration: scene.end - scene.start,
      });
    }
    return frames.length ? frames : scenes;
  } catch (e) {
    console.warn(`  ⚠️  Baking in captions failed, using plain scenes: ${e.message}`);
    return scenes;
  }
}

module.exports = { bakeInCaptions };
