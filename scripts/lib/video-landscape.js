const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

function renderClip({ imageFile, duration, index, output }) {
  const frames = Math.max(1, Math.round(duration * FPS));
  const t = `(on/${FPS})`;
  const zoom = index % 2 ? `max(1.0,1.15-0.03*${t})` : `min(1.0+0.03*${t},1.15)`;
  // Cover-crop to 16:9 before zooming: a plain scale=3840:2160 stretches any
  // source that isn't already 16:9 (a portrait scene image came out with
  // visibly squashed people in a real render).
  const fill = `scale=${WIDTH * 2}:${HEIGHT * 2}:force_original_aspect_ratio=increase,crop=${WIDTH * 2}:${HEIGHT * 2}`;
  execFileSync('ffmpeg', ['-y', '-loop', '1', '-i', imageFile, '-vf', `${fill},zoompan=z='${zoom}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${WIDTH}x${HEIGHT}:fps=${FPS},format=yuv420p`, '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', output], { stdio: 'pipe' });
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
          return ['-vf', `ass=${assFile}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p'];
        })()
      : ['-c:v', 'copy'];
    execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-i', audioPath, ...video, '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', outPath], { stdio: 'pipe' });
    return outPath;
  } finally { fs.rmSync(tempDir, { recursive: true, force: true }); }
}

module.exports = { FPS, WIDTH, HEIGHT, renderLandscapeVideo };
