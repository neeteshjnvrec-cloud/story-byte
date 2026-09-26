const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildAss } = require('./landscape-captions');

const execFileAsync = promisify(execFile);

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
// The still is upscaled once to 3x before zoompan crops from it: zoompan
// positions its crop on whole pixels of the canvas, and at 3x that's a third
// of an output pixel per step — smooth drift instead of the shimmer a 1-2x
// canvas gives on slow moves. 4x was measured at ~1.7x the render time of
// 3x for no visible gain.
const CANVAS = 3;
const ZOOM = 0.12;

/**
 * Four camera moves, cycled per scene: push in, drift right, pull out, drift
 * left. Each spans the WHOLE clip — a fixed rate (the previous 0.03/s)
 * reached its cap after ~5s and left a 30-45s scene frozen for the rest.
 */
function motion(index, frames) {
  const p = `(on/${Math.max(1, frames - 1)})`;
  const centre = { x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' };
  switch (index % 4) {
    case 0: return { z: `1+${ZOOM}*${p}`, ...centre };
    case 1: return { z: `${1 + ZOOM}`, x: `(iw-iw/zoom)*${p}`, y: centre.y };
    case 2: return { z: `${1 + ZOOM}-${ZOOM}*${p}`, ...centre };
    default: return { z: `${1 + ZOOM}`, x: `(iw-iw/zoom)*(1-${p})`, y: centre.y };
  }
}

/**
 * Renders one scene straight to its final encode: Ken Burns motion plus that
 * scene's slice of the burned-in captions, at the final quality. The clips
 * are then joined with a stream copy, so every frame is encoded exactly once
 * — the old separate caption pass re-encoded the whole episode a second
 * time (over 20 minutes on its own for a 30-minute episode, and a second
 * generation of compression loss).
 */
async function renderClip({ imageFile, frames, index, output, assFile }) {
  const { z, x, y } = motion(index, frames);
  const w = WIDTH * CANVAS;
  const h = HEIGHT * CANVAS;
  // Cover-crop to 16:9 before zooming: a plain scale stretches any source
  // that isn't already 16:9 (a portrait scene image came out with visibly
  // squashed people in a real render). The image is a single input frame
  // and zoompan's d= emits every output frame from it, so the expensive 3x
  // scale runs once per scene rather than once per output frame.
  let vf = `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},` +
    `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},format=yuv420p`;
  if (assFile) vf += `,ass=${assFile}`;
  // CRF 18 / preset medium: visually clean for YouTube/Facebook to
  // re-encode from, rather than their encoder stacking on top of an
  // already-soft upload.
  await execFileAsync('ffmpeg', ['-y', '-i', imageFile, '-vf', vf, '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), output],
    { maxBuffer: 64 * 1024 * 1024 });
}

// zoompan and the x264 lookahead each keep only ~1.5 cores busy per clip, so
// a few scenes rendering side by side use the whole runner instead of one
// scene at a time leaving most of it idle.
const CONCURRENCY = Math.max(1, Math.min(4, os.cpus().length - 1));

async function pool(items, limit, worker) {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

/** Caption lines overlapping [start, end), re-timed to that clip's own clock. */
function clipCaptions(captions, start, end) {
  return captions
    .filter((l) => l.end > start && l.start < end)
    .map((l) => ({ ...l, start: Math.max(0, l.start - start), end: Math.min(end, l.end) - start }));
}

/**
 * `captions` ([{ start, end, text }] on the episode's clock, see
 * lib/landscape-captions.js) are burned in per clip; `font` names the
 * caption font for the narration language.
 */
async function renderLandscapeVideo({ scenes, audioPath, outPath, captions = [], font }) {
  if (!scenes?.length || !fs.existsSync(audioPath)) return null;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storybyte-landscape-'));
  const listFile = path.join(tempDir, 'clips.txt');
  try {
    // Frame boundaries come from the running total, so per-scene rounding
    // never accumulates into the picture drifting from the narration.
    let elapsed = 0;
    const clips = scenes.map((scene, index) => {
      const start = elapsed;
      elapsed += scene.duration;
      const frames = Math.max(1, Math.round(elapsed * FPS) - Math.round(start * FPS));
      const t0 = Math.round(start * FPS) / FPS;
      return { scene, index, frames, t0, t1: t0 + frames / FPS, output: path.join(tempDir, `clip-${index}.mp4`) };
    });

    await pool(clips, CONCURRENCY, async (clip) => {
      const lines = clipCaptions(captions, clip.t0, clip.t1);
      let assFile = null;
      if (lines.length) {
        assFile = path.join(tempDir, `clip-${clip.index}.ass`);
        fs.writeFileSync(assFile, buildAss(lines, { width: WIDTH, height: HEIGHT, font }), 'utf8');
      }
      await renderClip({ imageFile: clip.scene.file, frames: clip.frames, index: clip.index, output: clip.output, assFile });
      console.log(`  Rendered scene ${clip.index + 1}/${clips.length}`);
    });

    fs.writeFileSync(listFile, clips.map((c) => `file '${path.resolve(c.output)}'`).join('\n'));
    execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-i', audioPath,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest',
      '-movflags', '+faststart', outPath], { stdio: 'pipe' });
    return outPath;
  } finally { fs.rmSync(tempDir, { recursive: true, force: true }); }
}

module.exports = { FPS, WIDTH, HEIGHT, renderLandscapeVideo, clipCaptions };
