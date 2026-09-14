/**
 * Turns a set of story scene images + the story's real TTS narration into an
 * MP4 — the only way to get the narration actually playing on Instagram/
 * Facebook, since carousels are silent. Captions, when present, are already
 * baked into the scene images themselves (see lib/caption-frames.js) —
 * ffmpeg's own `subtitles` filter turned out to be unreliable layered over
 * a fast-changing concat-demuxer sequence, so this stays a plain renderer.
 *
 * Uses ffmpeg directly (already installed in the CI workflows for
 * edge-tts). Never throws — a failed render just means no video post this
 * time, the carousel/photo post still goes out.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
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

/**
 * Builds an MP4 at `outPath` from `scenes` ([{ file, duration? }], local
 * image paths in display order) and `audioPath` (local mp3).
 *
 * `duration` (seconds) is per-scene and optional — omit it (on every scene)
 * to fall back to splitting the audio's duration evenly across them, which
 * is what happens when the caller couldn't build narration-timed scenes
 * (see lib/video-scenes.js) and fell back to the carousel's own teaser
 * slides instead.
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

  const listFile = `${outPath}.txt`;
  const lines = [];
  for (const scene of scenes) {
    lines.push(`file '${path.resolve(scene.file)}'`);
    lines.push(`duration ${Math.max(0.5, scene.duration || perSlide).toFixed(2)}`);
  }
  // ffmpeg's concat demuxer ignores the last entry's duration, so the final
  // image needs to be repeated once more without one to actually hold for
  // its share of the audio instead of flashing by.
  lines.push(`file '${path.resolve(scenes[scenes.length - 1].file)}'`);

  try {
    fs.writeFileSync(listFile, lines.join('\n'));
    execFileSync('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-i', audioPath,
      // Instagram Reels processing (unlike Facebook's video post, which
      // accepts our native 4:5 slides fine) is strict about both aspect
      // ratio and frame rate: it wants 9:16, and a concat of still images
      // with no explicit output rate can produce an effective frame rate
      // far below what Reels' async processor will accept — both silently
      // pass container creation and only fail later as
      // "container ... failed processing". Pad into a 1080x1920 canvas and
      // force a real constant frame rate to satisfy it.
      '-vf', 'scale=1080:1350,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p',
      '-r', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
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
  }
}

module.exports = { buildStoryVideo };
