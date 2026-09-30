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
 *  re-encode), or with a `fadeOutSec` fade at the end (re-encoded) so a
 *  music bed doesn't stop dead at the cut. Returns the output path, or
 *  null on failure. */
function clipAudio(audioPath, maxDurationSec, outPath, { fadeOutSec = 0 } = {}) {
  try {
    const codec = fadeOutSec > 0
      ? ['-af', `afade=t=out:st=${Math.max(0, maxDurationSec - fadeOutSec).toFixed(2)}:d=${fadeOutSec}`, '-c:a', 'libmp3lame', '-b:a', '160k']
      : ['-c', 'copy'];
    execFileSync('ffmpeg', ['-y', '-i', audioPath, '-t', String(maxDurationSec), ...codec, outPath], { stdio: 'pipe' });
    return fs.existsSync(outPath) ? outPath : null;
  } catch {
    return null;
  }
}

// The daily devotional story's Short — the same clip goes to YouTube Shorts,
// Instagram Reels and Facebook. Under a minute: that's where this channel's
// Shorts get their views (its 3-5 minute vertical uploads count as regular
// videos and drew 1-7 views each).
const SHORT_MAX_SEC = 58;

/** Where to cut a Short so it ends on a finished sentence: the end of the
 *  last cue that closes a sentence before `maxSec` (edge-tts cues are
 *  sentence-sized), else the last cue before it, else `maxSec` itself. */
function shortCutoff(cues, maxSec = SHORT_MAX_SEC) {
  const fits = (cues || []).filter((c) => c.end <= maxSec);
  const sentence = [...fits].reverse().find((c) => /[.!?।॥]["'”’]?\s*$/.test(String(c.text || '').trim()));
  const pick = sentence || fits[fits.length - 1];
  return pick && pick.end >= maxSec * 0.5 ? pick.end + 0.3 : maxSec;
}

module.exports = { REEL_MAX_SEC, SHORT_MAX_SEC, clipScenes, clipAudio, shortCutoff };
