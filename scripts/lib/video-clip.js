/**
 * Trims a rendered video's scenes + narration audio to a short clip for
 * Instagram Reels specifically. Reels published via the Graph API are only
 * reliably processed up to roughly 90 seconds (Facebook's plain video post
 * has no such limit) — a multi-minute narration that publishes fine as a
 * Facebook video consistently fails Reels' async processing
 * ("container ... failed processing") if sent in full. The full-length
 * video still goes to Facebook unchanged; this clip is Instagram-only.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

// Comfortably under the ~90s ceiling so encoding rounding never tips it over.
const REEL_MAX_SEC = 85;

/** Returns a new [{ file, duration }] list covering at most `maxDurationSec`,
 *  with the last included scene's duration shortened to land exactly on the
 *  cutoff instead of overshooting it. */
function clipScenes(scenes, maxDurationSec) {
  const out = [];
  let elapsed = 0;
  for (const scene of scenes) {
    if (elapsed >= maxDurationSec) break;
    const duration = Math.min(scene.duration, maxDurationSec - elapsed);
    // Keep sceneIndex/sceneElapsed/sceneDuration: without them every
    // caption frame of the clip restarted its scene's camera move.
    out.push({ ...scene, duration });
    elapsed += duration;
  }
  return out;
}

/** Trims `audioPath` to `maxDurationSec` via a fast stream copy (no
 *  re-encode). Returns the output path, or null on failure. */
function clipAudio(audioPath, maxDurationSec, outPath) {
  try {
    execFileSync('ffmpeg', ['-y', '-i', audioPath, '-t', String(maxDurationSec), '-c', 'copy', outPath], { stdio: 'pipe' });
    return fs.existsSync(outPath) ? outPath : null;
  } catch {
    return null;
  }
}

module.exports = { REEL_MAX_SEC, clipScenes, clipAudio };
