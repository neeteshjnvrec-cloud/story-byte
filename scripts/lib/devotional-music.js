/**
 * A soft devotional music bed under the narration of the social videos: a
 * tanpura-style drone (Pa-Sa-Sa-low Sa plucked on a 4s cycle) with a warm
 * low pad and a temple bell every 16s, synthesised from scratch with
 * ffmpeg — original audio, so there's no music licence to worry about.
 *
 * The tonic (Sa) changes with the day so consecutive Shorts don't carry an
 * identical soundtrack. The bed is ducked under the voice (sidechain
 * compression) and faded in/out. Only the social videos get it; the app's
 * own mp3 stays plain narration.
 *
 * Never throws: returns null on failure and the caller keeps the plain
 * narration.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// B2, C3, C#3, D3 — comfortable tanpura tonics under a speaking voice.
const TONICS = [123.47, 130.81, 138.59, 146.83];
// One full cycle of every element below (4s plucks, 16s bell, 1/16 Hz pad
// swell), so the loop repeats seamlessly.
const LOOP_SEC = 32;

function droneExpression(f0) {
  const T = 4;
  const strings = [[f0 * 0.75, 0], [f0, 1], [f0, 2], [f0 * 0.5, 3]];
  const harmonics = [[1, 1], [2, 0.6], [3, 0.45], [4, 0.3], [5, 0.22], [6, 0.15], [8, 0.08]];
  const plucks = strings.map(([f, offset]) => {
    const env = `exp(-0.9*mod(t+${T - offset},${T}))`;
    return `${env}*(${harmonics.map(([k, a]) => `${a}*sin(${k}*2*PI*${f}*t)`).join('+')})`;
  });
  const pad = `sin(2*PI*${f0 / 2}*t)*(0.8+0.2*sin(2*PI*0.0625*t))`;
  const bellPartials = [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.9, 0.12]]
    .map(([r, a]) => `${a}*sin(2*PI*${f0 * 4 * r}*t)`).join('+');
  const bell = `exp(-1.2*mod(t,16))*(${bellPartials})`;
  return `0.05*(${plucks.join('+')})+0.0175*${pad}+0.02*${bell}`;
}

function durationOf(file) {
  try {
    return parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Mixes the music bed under `narrationPath` into `outPath` (mp3). `variant`
 * (any integer, e.g. the day's style seed) picks the tonic.
 */
function mixDevotionalMusic(narrationPath, outPath, { variant = 0 } = {}) {
  const dur = durationOf(narrationPath);
  if (!dur) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-music-'));
  try {
    const loop = path.join(dir, 'loop.wav');
    const f0 = TONICS[Math.abs(variant) % TONICS.length];
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `aevalsrc='${droneExpression(f0)}':s=44100:d=${LOOP_SEC}`,
      '-af', 'lowpass=f=3500', loop], { stdio: 'pipe' });

    const fadeOut = Math.max(0, dur - 3).toFixed(2);
    execFileSync('ffmpeg', ['-y', '-i', narrationPath, '-stream_loop', '-1', '-i', loop,
      '-filter_complex',
      // Echo gives the dry synth a temple-hall space; the bed then ducks
      // ~6:1 whenever the narrator speaks, so it fills pauses without ever
      // competing with the words.
      `[1:a]atrim=0:${dur.toFixed(2)},aecho=0.8:0.7:60|120:0.3|0.2,volume=0.7,` +
      `afade=t=in:d=2,afade=t=out:st=${fadeOut}:d=3[bed];` +
      '[0:a]asplit=2[voice][key];' +
      '[bed][key]sidechaincompress=threshold=0.04:ratio=6:attack=30:release=500[ducked];' +
      '[voice][ducked]amix=inputs=2:duration=first:normalize=0[out]',
      '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '160k', outPath], { stdio: 'pipe' });
    return fs.existsSync(outPath) ? outPath : null;
  } catch (e) {
    console.warn(`  ⚠️  Music bed failed, using plain narration: ${e.message.split('\n')[0]}`);
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { mixDevotionalMusic };
