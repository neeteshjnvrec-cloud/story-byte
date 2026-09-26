const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

function renderClip({ imageFile, duration, index, output }) {
  const frames = Math.max(1, Math.round(duration * FPS));
  const { z, x, y } = motion(index, frames);
  const w = WIDTH * CANVAS;
  const h = HEIGHT * CANVAS;
  // Cover-crop to 16:9 before zooming: a plain scale stretches any source
  // that isn't already 16:9 (a portrait scene image came out with visibly
  // squashed people in a real render). The image is a single input frame
  // and zoompan's d= emits every output frame from it, so the expensive 4x
  // scale runs once per scene rather than once per output frame.
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},` +
    `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},format=yuv420p`;
  // Near-transparent intermediate (CRF 12): these clips get re-encoded once
  // more in the final pass, so their own loss would compound.
  execFileSync('ffmpeg', ['-y', '-i', imageFile, '-vf', vf, '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', output], { stdio: 'pipe' });
}

/**
 * `assContent`, when given, is burned onto the concatenated video in the
 * final pass (see lib/landscape-captions.js). That pass has to re-encode, so
 * without captions the concat stays a cheap stream copy.
 */
function renderLandscapeVideo({ scenes, audioPath, outPath, assContent }) {
  if (!scenes?.length || !fs.existsSync(audioPath)) return null;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storybyte-landscape-'));
  const listFile = path.join(tempDir, 'clips.txt');
  try {
    const clips = scenes.map((scene, index) => { const output = path.join(tempDir, `clip-${index}.mp4`); renderClip({ imageFile: scene.file, duration: scene.duration, index, output }); return output; });
    fs.writeFileSync(listFile, clips.map(file => `file '${path.resolve(file)}'`).join('\n'));
    const video = assContent
      ? (() => {
          const assFile = path.join(tempDir, 'captions.ass');
          fs.writeFileSync(assFile, assContent, 'utf8');
          // CRF 18 / preset medium: visually clean for YouTube/Facebook to
          // re-encode from, rather than their encoder stacking on top of an
          // already-soft upload.
          return ['-vf', `ass=${assFile}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
        })()
      : ['-c:v', 'copy'];
    execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-i', audioPath, ...video, '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', outPath], { stdio: 'pipe' });
    return outPath;
  } finally { fs.rmSync(tempDir, { recursive: true, force: true }); }
}

module.exports = { FPS, WIDTH, HEIGHT, renderLandscapeVideo };
