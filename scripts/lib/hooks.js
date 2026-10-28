/**
 * The first three seconds of a Short decide whether a viewer keeps watching
 * or swipes on. Two parts of that live here:
 *
 *  - the spoken hook: a katha that opens with slow scene-setting ("एक समय
 *    की बात है…") gets its first two sentences rewritten into a hook before
 *    it's narrated (sharpenOpening), the rest of the story untouched;
 *  - the on-screen hook: a short line drawn big across the top of the
 *    opening frames (lib/caption-frames.js), for the many viewers who
 *    scroll with the sound off.
 */

// Openings that set a scene instead of hooking: "Once upon a time", "Long
// ago", "In ancient times", "It is said", "This story is about…".
const SLOW_OPENERS = [
  /^एक\s+(समय|बार|दिन|ज़माने|जमाने)/,
  /^बहुत\s+(समय|पहले|पुरानी|साल)/,
  /^(प्राचीन|पुराने|पुरातन)\s+(काल|समय|ज़माने|जमाने)/,
  /^(हज़ारों|हजारों|सैकड़ों)\s+(साल|वर्ष)/,
  /^(कहा\s+जाता|कहते\s+हैं)/,
  /^(यह|ये)\s+(कहानी|कथा|बात)/,
  /^(आज\s+(हम|की\s+कथा))/,
  /^once upon a time/i,
  /^long,?\s+(long\s+)?ago/i,
  /^(in\s+)?ancient\s+times/i,
  /^(this|today'?s)\s+(story|katha)/i,
];
// A hook is short: longer than this and the first sentence is still talking
// when the viewer decides.
const MAX_HOOK_WORDS = 18;

function sentences(text) {
  return String(text || '').trim().split(/(?<=[।!?.|])\s+/).filter(Boolean);
}

/** Why the story's opening is slow, or null when it hooks. */
function slowOpening(text) {
  const first = (sentences(text)[0] || '').replace(/^["'“‘\s]+/, '');
  if (!first) return null;
  if (SLOW_OPENERS.some((re) => re.test(first))) return `opens with "${first.split(/\s+/).slice(0, 4).join(' ')}…"`;
  const words = first.split(/\s+/).length;
  if (words > MAX_HOOK_WORDS) return `first sentence is ${words} words`;
  return null;
}

/**
 * `text` with its first two sentences rewritten into a hook (the rest kept
 * exactly, paragraph breaks and all), or null when the rewrite failed or is
 * still slow. `askJson(system, user)` → parsed JSON reply; `hookStyle` is
 * the opening style (for a Short, the day's: lib/short-style.js); `what`
 * names the kind of video.
 */
async function sharpenOpening(askJson, { title, text, hookStyle, what = 'Hindi devotional katha for a YouTube Short' }) {
  const all = sentences(text);
  if (all.length < 4) return null;
  const opening = all.slice(0, 2).join(' ');
  const next = all[2];
  const restAt = text.indexOf(all[1]) + all[1].length;
  const sys = `You edit the opening of a narrated ${what}. Viewers leave in ` +
    'the first seconds, and this opening is slow scene-setting. Rewrite ONLY these opening sentences into a ' +
    `gripping hook: ${hookStyle || 'open on the most astonishing moment of the katha, or a question the viewer must have answered'}. ` +
    `The first sentence has at most ${MAX_HOOK_WORDS - 6} words and already holds the conflict, the question or the ` +
    'astonishing moment. Never begin with एक समय, एक बार, बहुत समय पहले, प्राचीन काल, कहा जाता है or यह कथा. ' +
    'Then bridge in one short sentence so the story carries on naturally into its next sentence, which stays as it is. ' +
    'Same language and spoken style; faithful to the traditional story, no invented events. ' +
    'Reply with JSON only: {"opening": string}.';
  const user = `Title: ${title}\nOpening to rewrite: ${opening}\nThe sentence that follows it (unchanged): ${next}`;
  const reply = await askJson(sys, user);
  const rewritten = String(reply?.opening || '').trim();
  if (rewritten.length < 20 || rewritten.length > 400 || slowOpening(rewritten)) return null;
  return `${rewritten}${text.slice(restAt)}`;
}

// The on-screen hook must read in a glance: about two short lines.
const MAX_HOOK_TEXT = 34;

/** The on-screen hook for a Short: the story's own hookText, else its
 *  social title without the emoji, cut at a word. */
function hookTextOf(content) {
  const raw = String(content?.hookText || content?.socialTitle || '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  if (raw.length <= MAX_HOOK_TEXT) return raw || null;
  const cut = raw.slice(0, MAX_HOOK_TEXT + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 12 ? cut.lastIndexOf(' ') : MAX_HOOK_TEXT).trim()}…`;
}

module.exports = { slowOpening, sharpenOpening, hookTextOf, sentences };
