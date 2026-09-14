/**
 * Turns the carousel slide images + the story's real TTS narration into an
 * MP4 slideshow — each slide shown for an equal share of the audio's
 * duration, audio as the soundtrack. This is the only way to get the
 * narration actually playing on Instagram/Facebook (carousels are silent).
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
 * Builds an MP4 at `outPath` from `slideFiles` (local image paths, shown in
 * order) and `audioPath` (local mp3). Returns `outPath` on success, or null.
 */
function buildStoryVideo({ slideFiles, audioPath, outPath }) {
  if (!slideFiles?.length || !fs.existsSync(audioPath)) return null;

  const audioDur = ffprobeDuration(audioPath);
  if (!audioDur) {
    console.warn('  ⚠️  Video render skipped: could not read audio duration');
    return null;
  }
  const perSlide = Math.max(2, audioDur / slideFiles.length);

  const listFile = `${outPath}.txt`;
  const lines = [];
  for (const f of slideFiles) {
    lines.push(`file '${path.resolve(f)}'`);
    lines.push(`duration ${perSlide.toFixed(2)}`);
  }
  // ffmpeg's concat demuxer ignores the last entry's duration, so the final
  // image needs to be repeated once more without one to actually hold for
  // its share of the audio instead of flashing by.
  lines.push(`file '${path.resolve(slideFiles[slideFiles.length - 1])}'`);

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
