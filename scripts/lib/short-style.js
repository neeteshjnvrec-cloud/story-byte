/**
 * The day's "look" for the devotional Short, so consecutive days don't come
 * out of one visibly identical template (platforms push down repetitive,
 * mass-produced uploads): camera-move order, colour grade, caption colour
 * and position, the opening style the story is written with, and the
 * music's tonic all change with the date. Deterministic per date, so a
 * re-run of the same day renders the same look.
 */

const GRADES = [
  { name: 'temple gold', eq: 'eq=saturation=1.12:contrast=1.05:gamma=0.98', balance: 'colorbalance=rs=0.05:gs=0.01:bs=-0.05' },
  { name: 'dawn saffron', eq: 'eq=saturation=1.08:contrast=1.03:brightness=0.02', balance: 'colorbalance=rs=0.07:gs=0.02:bs=-0.03' },
  { name: 'deep devotion', eq: 'eq=saturation=1.15:contrast=1.08:gamma=0.95', balance: 'colorbalance=rs=0.02:bs=0.03' },
  { name: 'soft divine', eq: 'eq=saturation=1.0:contrast=1.0:brightness=0.03:gamma=1.03', balance: 'colorbalance=rs=0.03:gs=0.02:bs=0.0' },
];

// fill / highlight colour for the burned-in captions.
const CAPTION_COLOURS = ['#FFFFFF', '#FFD54F', '#FFE0B2', '#FFF59D'];

// Where the caption block sits (fraction of height, measured to its bottom
// edge). All inside the Shorts/Reels safe zone — the bottom ~20% is
// covered by the title, buttons and progress bar.
const CAPTION_BOTTOMS = [0.74, 0.7, 0.66];

// How the first two sentences hook the viewer (see generateText).
const HOOKS = [
  'open on the single most astonishing moment of the katha, then go back to how it began',
  'open with a question the viewer cannot help wanting answered',
  'open with a line of dialogue spoken by the deity or a devotee at the story\'s turning point',
  'open with "क्या आप जानते हैं…" and a little-known detail of this katha',
];

// A real hash: a simple rolling one moves by exactly 1 between
// consecutive dates, which kept every element cycling in lockstep.
function seedOf(text) {
  return require('crypto').createHash('md5').update(String(text)).digest().readUInt32BE(0);
}

// Each element hashes the date with its own salt: consecutive dates have
// consecutive seeds, so dividing one seed would change most of the look
// only every few weeks.
const pick = (list, dateStr, salt) => list[seedOf(`${salt}:${dateStr}`) % list.length];

function styleOfDay(dateStr) {
  return {
    seed: seedOf(dateStr),
    grade: pick(GRADES, dateStr, 'grade'),
    captionColour: pick(CAPTION_COLOURS, dateStr, 'caption'),
    captionBottom: pick(CAPTION_BOTTOMS, dateStr, 'position'),
    // Starting point in lib/video.js's cycle of camera moves.
    motionOffset: pick([0, 1, 2, 3], dateStr, 'motion'),
    hook: pick(HOOKS, dateStr, 'hook'),
  };
}

// YouTube classifies vertical uploads of up to 3 minutes as Shorts. A
// complete katha is written for ~2.5 minutes; one that runs a little over
// is sped up (pitch unchanged) by at most MAX_TEMPO to stay a Short, and
// anything longer still posts complete, just as a regular video.
const SHORTS_MAX_SEC = 176;
const MAX_TEMPO = 1.12;
// Music carries on this long after the last word, then fades.
const END_TAIL_SEC = 2.5;

/** Narration speed-up (1 = none) that fits `durSec` plus the tail into a Short. */
function shortsTempo(durSec) {
  const room = SHORTS_MAX_SEC - END_TAIL_SEC;
  return durSec > room ? Math.min(MAX_TEMPO, durSec / room) : 1;
}

module.exports = { styleOfDay, shortsTempo, END_TAIL_SEC };
