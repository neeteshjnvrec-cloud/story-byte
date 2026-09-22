/**
 * Turns a set of story scene images + the story's real TTS narration into an
 * MP4 — the only way to get the narration actually playing on Instagram/
 * Facebook, since carousels are silent. Captions, when present, are already
 * baked into the scene images themselves (see lib/caption-frames.js) —
 * ffmpeg's own `subtitles` filter turned out to be unreliable layered over
 * a fast-changing concat-demuxer sequence, so this stays a plain renderer.
 *
 * Each still is rendered as a slow zoom/pan (Ken Burns) clip rather than a
 * frozen frame — a hard cut between flat images reads as a slideshow, not
 * a video.
 *
 * Uses ffmpeg directly (already installed in the CI workflows for
 * edge-tts). Never throws — a failed render just means no video post this
 * time, the carousel/photo post still goes out.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function ffprobeDuration(file) {
  try {
    return (
      parseFloat(
        execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
          .toString()
          .trim()
      ) || 0
    );
  } catch {
    return 0;
  }
}

const FPS = 30;
const ZOOM_MAX = 1.15;
const ZOOM_PER_SEC = 0.03; // 1.0 -> 1.15 over ~5s, then holds at the cap

/**
 * Renders one still as a short Ken Burns clip: a slow, steady zoom in (even
 * scene index) or out (odd), alternating so consecutive scenes don't all
 * creep the same direction. `sceneElapsed` is this clip's start offset into
 * its *scene's* zoom curve, not its own — when one background scene has
 * been split into several caption-frame stills (lib/caption-frames.js),
 * every fragment renders a slice of the same continuous curve instead of
 * restarting at 1.0x, so the motion doesn't visibly reset every caption
 * line. `zoompan`'s own `zoom` self-reference is avoided for exactly that
 * reason: it can only continue smoothly within one ffmpeg invocation, and
 * every clip here is its own invocation.
 */
function buildKenBurnsClip({ imageFile, duration, sceneIndex, sceneElapsed, clipPath }) {
  const frames = Math.max(1, Math.round(duration * FPS));
  const zoomOut = sceneIndex % 2 === 1;
  const t = `(${sceneElapsed}+on/${FPS})`;
  const zExpr = zoomOut
    ? `max(1.0,${ZOOM_MAX}-${ZOOM_PER_SEC}*${t})`
    : `min(1.0+${ZOOM_PER_SEC}*${t},${ZOOM_MAX})`;
  execFileSync('ffmpeg', [
    '-y', '-loop', '1', '-i', imageFile,
    '-vf',
      // Upscale before zoompan so cropping into the image at 1.15x is still
      // sampling from more source detail than the 1080x1350 output needs,
      // instead of visibly softening as it zooms in.
      `scale=2160:2700,zoompan=z='${zExpr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350:fps=${FPS},` +
      `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`,
    '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    clipPath,
  ], { stdio: 'pipe' });
}

/**
 * Builds an MP4 at `outPath` from `scenes` ([{ file, duration?, sceneIndex?,
 * sceneElapsed? }], local image paths in display order) and `audioPath`
 * (local mp3).
 *
 * `duration` (seconds) is per-scene and optional — omit it (on every scene)
 * to fall back to splitting the audio's duration evenly across them, which
 * is what happens when the caller couldn't build narration-timed scenes
 * (see lib/video-scenes.js) and fell back to the carousel's own teaser
 * slides instead. `sceneIndex`/`sceneElapsed` are also optional — omitted,
 * each entry is treated as its own independent scene (index = its position
 * in the array, elapsed = 0), which is correct whenever one entry is one
 * whole scene; only lib/caption-frames.js's fragments need to pass them
 * explicitly.
 *
 * Returns `outPath` on success, or null.
 */
function buildStoryVideo({ scenes, audioPath, outPath }) {
  if (!scenes?.length || !fs.existsSync(audioPath)) return null;

  let perSlide = 0;
  if (scenes.some((s) => !s.duration)) {
    const audioDur = ffprobeDuration(audioPath);
    if (!audioDur) {
      console.warn('  ⚠️  Video render skipped: could not read audio duration');
      return null;
    }
    perSlide = Math.max(2, audioDur / scenes.length);
  }

  const clipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kenburns-'));
  const listFile = `${outPath}.txt`;
  try {
    const clipFiles = scenes.map((scene, i) => {
      const clipPath = path.join(clipDir, `clip-${i}.mp4`);
      buildKenBurnsClip({
        imageFile: scene.file,
        duration: Math.max(0.5, scene.duration || perSlide),
        sceneIndex: scene.sceneIndex ?? i,
        sceneElapsed: scene.sceneElapsed ?? 0,
        clipPath,
      });
      return clipPath;
    });

    fs.writeFileSync(listFile, clipFiles.map((f) => `file '${path.resolve(f)}'`).join('\n'));
    execFileSync('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-i', audioPath,
      // Every clip above was already encoded at the same size/codec/frame
      // rate, so the concat can stream-copy the video instead of
      // re-encoding a second time.
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '128k',
      '-shortest', '-movflags', '+faststart',
      outPath,
    ], { stdio: 'pipe' });
    return outPath;
  } catch (e) {
    console.warn(`  ⚠️  Video render failed: ${e.message}`);
    return null;
  } finally {
    try {
      fs.unlinkSync(listFile);
    } catch {
      /* best-effort cleanup */
    }
    fs.rmSync(clipDir, { recursive: true, force: true });
  }
}

module.exports = { buildStoryVideo };
