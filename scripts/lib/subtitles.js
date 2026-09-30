/**
 * Parses the .srt file edge-tts's --write-subtitles produces (one cue per
 * spoken word, timestamped against the real narration audio) and regroups
 * it into short readable caption lines — real speech timing, not an
 * even-split guess. Lines are baked directly onto video frames by
 * lib/caption-frames.js.
 */
function tsToSeconds(ts) {
  const m = String(ts || '').match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  const [, h, mi, s, ms] = m;
  return Number(h) * 3600 + Number(mi) * 60 + Number(s) + Number(ms) / 1000;
}

/** Returns [{ start, end, text }] in seconds, one entry per SRT cue
 *  (edge-tts: one per spoken word). Never throws — an unparseable file
 *  yields an empty array, which callers treat as "no timing available". */
function parseSrt(srtText) {
  try {
    const blocks = String(srtText || '').replace(/\r/g, '').trim().split(/\n\n+/);
    const cues = [];
    for (const block of blocks) {
      const lines = block.split('\n').filter(Boolean);
      const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeLineIdx === -1) continue;
      const [startTs, endTs] = lines[timeLineIdx].split('-->').map((s) => s.trim());
      const text = lines.slice(timeLineIdx + 1).join(' ').trim();
      if (!text) continue;
      cues.push({ start: tsToSeconds(startTs), end: tsToSeconds(endTs), text });
    }
    return cues;
  } catch {
    return [];
  }
}

/** Newer edge-tts builds write one cue per *sentence*, not per word — a
 *  whole sentence then became one caption, truncated with "…" after three
 *  lines and held on screen for 8+ seconds (seen in a real Short). Splits
 *  any multi-word cue into per-word cues across its time span, weighted by
 *  word length, so the grouping below always works on words. */
function toWordCues(cues) {
  const out = [];
  for (const cue of cues) {
    const words = String(cue.text || '').split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      out.push(cue);
      continue;
    }
    const weight = words.reduce((sum, w) => sum + w.length + 1, 0);
    let t = cue.start;
    for (const word of words) {
      const d = (cue.end - cue.start) * ((word.length + 1) / weight);
      out.push({ start: t, end: t + d, text: word });
      t += d;
    }
  }
  return out;
}

/** Groups consecutive word cues into short caption lines — each line still
 *  starts/ends exactly when its first/last word is actually spoken, just
 *  merged so captions don't flash one word at a time. */
function toCaptionLines(cues, { maxWords = 6, maxDurSec = 2.5 } = {}) {
  const lines = [];
  let cur = null;
  for (const cue of toWordCues(cues)) {
    if (!cur) {
      cur = { start: cue.start, end: cue.end, words: [cue.text] };
      continue;
    }
    if (cur.words.length >= maxWords || cue.end - cur.start > maxDurSec) {
      lines.push(cur);
      cur = { start: cue.start, end: cue.end, words: [cue.text] };
    } else {
      cur.end = cue.end;
      cur.words.push(cue.text);
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => ({ start: l.start, end: l.end, text: l.words.join(' ') }));
}

module.exports = { parseSrt, toCaptionLines };
