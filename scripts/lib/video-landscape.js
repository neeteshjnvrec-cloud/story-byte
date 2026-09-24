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
  execFileSync('ffmpeg', ['-y', '-loop', '1', '-i', imageFile, '-vf', `scale=3840:2160,zoompan=z='${zoom}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${WIDTH}x${HEIGHT}:fps=${FPS},format=yuv420p`, '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', output], { stdio: 'pipe' });
}

function renderLandscapeVideo({ scenes, audioPath, outPath }) {
  if (!scenes?.length || !fs.existsSync(audioPath)) return null;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storybyte-landscape-'));
  const listFile = `${outPath}.txt`;
  try {
    const clips = scenes.map((scene, index) => { const output = path.join(tempDir, `clip-${index}.mp4`); renderClip({ imageFile: scene.file, duration: scene.duration, index, output }); return output; });
    fs.writeFileSync(listFile, clips.map(file => `file '${path.resolve(file)}'`).join('\n'));
    execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-i', audioPath, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', outPath], { stdio: 'pipe' });
    return outPath;
  } finally { fs.rmSync(listFile, { force: true }); fs.rmSync(tempDir, { recursive: true, force: true }); }
}

module.exports = { FPS, WIDTH, HEIGHT, renderLandscapeVideo };
