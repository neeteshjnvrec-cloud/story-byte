/**
 * Burned-in captions for the 1920x1080 landscape episodes, as an ASS file
 * that lib/video-landscape.js renders with ffmpeg's libass filter.
 *
 * edge-tts writes one cue per sentence, and a long sentence can run 10+
 * seconds and 30+ words — far too much text to put on screen at once. Each
 * cue is split into short word-wrapped chunks, and the cue's own time span is
 * divided between them by character count, so every chunk still appears
 * while (roughly) its own words are being spoken.
 */

const MAX_CHARS = 64;

// Splits into as few chunks as fit under maxChars, then evens them out —
// filling each chunk greedily to the limit leaves a two-word orphan on
// screen for under a second at the end of a long sentence.
function splitText(text, maxChars) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const total = words.join(' ').length;
  if (!total) return [];
  const target = total / Math.ceil(total / maxChars);
  const chunks = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > target && next.length - target > target - current.length) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** [{ start, end, text }] sentence cues -> shorter [{ start, end, text }] lines. */
function toCaptionChunks(cues, maxChars = MAX_CHARS) {
  const out = [];
  for (const cue of cues) {
    const chunks = splitText(cue.text, maxChars);
    if (!chunks.length) continue;
    // edge-tts cues overlap their neighbours by ~50ms; clamp so two lines
    // never stack on screen at the handover.
    const start = Math.max(cue.start, out.length ? out[out.length - 1].end : 0);
    const span = Math.max(0.1, cue.end - start);
    const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
    let t = start;
    for (const chunk of chunks) {
      const d = span * (chunk.length / totalChars);
      out.push({ start: t, end: t + d, text: chunk });
      t += d;
    }
  }
  return out;
}

function assTime(seconds) {
  const cs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

// ASS treats `{...}` as override tags and `\` as an escape — neither may
// reach the renderer raw from story text.
function assEscape(text) {
  return String(text).replace(/[\\{}]/g, '').replace(/\r?\n/g, ' ');
}

/** Captions font per narration language — both are installed by the workflow. */
function captionFont(language) {
  return language === 'hi' ? 'Lohit Devanagari' : 'DejaVu Sans';
}

function buildAss(lines, { width = 1920, height = 1080, font = 'DejaVu Sans' } = {}) {
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // White text, black outline + soft shadow, bottom-centre, readable on
    // both bright and dark scene art without a solid box over the picture.
    `Style: Default,${font},56,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,1,0,0,0,100,100,0,0,1,3.5,1.5,2,160,160,70,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const events = lines.map(
    (l) => `Dialogue: 0,${assTime(l.start)},${assTime(l.end)},Default,,0,0,0,,${assEscape(l.text)}`
  );
  return [...header, ...events, ''].join('\n');
}

module.exports = { toCaptionChunks, buildAss, captionFont };
