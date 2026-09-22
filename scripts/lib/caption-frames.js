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
 */
async function bakeInCaptions(scenes, captionLines, outDir, audioDurSec) {
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
      const buf = await drawCaptionFrame(scene.file, line.text);
      const file = path.join(outDir, `caption-frame-${i + 1}.jpg`);
      fs.writeFileSync(file, buf);
      const isLast = i === captionLines.length - 1;
      const end = isLast ? Math.max(line.end, audioDurSec || line.end) : line.end;
      frames.push({
        file,
        duration: Math.max(0.5, end - line.start),
        sceneIndex: scene.index,
        sceneElapsed: Math.max(0, line.start - scene.start),
      });
    }
    return frames.length ? frames : scenes;
  } catch (e) {
    console.warn(`  ⚠️  Baking in captions failed, using plain scenes: ${e.message}`);
    return scenes;
  }
}

module.exports = { bakeInCaptions };
