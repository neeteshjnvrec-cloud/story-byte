/**
 * "Tomorrow's katha" teaser for the daily devotional Short: one line,
 * spoken in the same voice after the katha ends, captioned like the rest,
 * and repeated in the first comment and the description. The weekday
 * calendar knows tomorrow's story in advance, and giving viewers a reason
 * to come back tomorrow is what turns a one-off view into a habit.
 *
 * Only the social video gets the spoken line. The app's own mp3 stays the
 * katha alone, since "tomorrow" means nothing to someone listening next month.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parseSrt } = require('./subtitles');

const GAP_SEC = 0.6;

/** The teaser line when the writer didn't supply one. */
function fallbackTeaser(next) {
  const who = next?.deity?.hindi || next?.occasion?.name;
  return who ? `कल सुनिए — ${who} की एक और अद्भुत कथा 🙏` : null;
}

const exactDuration = (file) => {
  try {
    return parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString()) || 0;
  } catch {
    return 0;
  }
};

/**
 * Narrates `teaser` with `narrate(text, out, subsOut)` (the same engine and
 * voice as the katha) and appends it to `audio` after a short pause.
 * Returns { audioPath, cues } for the combined narration (cues = the katha's
 * plus the teaser's, shifted), or null if anything fails. The caller then
 * just uses the katha alone.
 */
async function appendSpokenTeaser({ audio, cues, teaser, narrate, workDir }) {
  if (!teaser) return null;
  try {
    const spoken = teaser.replace(/[\p{Extended_Pictographic}️]/gu, '').trim();
    const teaserAudio = path.join(workDir, 'teaser.mp3');
    const teaserSubs = path.join(workDir, 'teaser.srt');
    const result = await narrate(spoken, teaserAudio, teaserSubs);
    if (!result || !fs.existsSync(teaserAudio)) return null;
    const mainDur = exactDuration(audio);
    if (!mainDur) return null;
    const out = path.join(workDir, 'narration-with-teaser.mp3');
    const norm = 'aresample=24000,aformat=sample_fmts=fltp:channel_layouts=mono';
    execFileSync('ffmpeg', ['-y', '-i', audio, '-i', teaserAudio, '-filter_complex',
      `[0:a]${norm},apad=pad_dur=${GAP_SEC}[a];[1:a]${norm}[b];[a][b]concat=n=2:v=0:a=1[out]`,
      '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '128k', out], { stdio: 'pipe' });
    const offset = mainDur + GAP_SEC;
    const teaserCues = result.subtitlesPath && fs.existsSync(teaserSubs) ? parseSrt(fs.readFileSync(teaserSubs, 'utf8')) : [];
    const shifted = teaserCues.length
      ? teaserCues.map((c) => ({ ...c, start: c.start + offset, end: c.end + offset }))
      : [{ start: offset, end: exactDuration(out), text: spoken }];
    return { audioPath: out, cues: [...(cues || []), ...shifted] };
  } catch (e) {
    console.warn(`  ⚠️  Spoken teaser skipped: ${e.message.split('\n')[0]}`);
    return null;
  }
}

module.exports = { appendSpokenTeaser, fallbackTeaser, GAP_SEC };
