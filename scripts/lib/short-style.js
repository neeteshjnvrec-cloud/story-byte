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

// YouTube classifies vertical uploads of up to 3 minutes as Shorts, and it
// is a hard line: in the first week, the daily kathas that landed under it
// got 26-243 views as Shorts, while one that came out at 3:01 (and one at
// 3:25) was filed as a regular video and got 2-5. A complete katha is
// written for ~2.2 minutes; one that runs over is sped up (pitch unchanged)
// by at most MAX_TEMPO, and the music tail after the last word shrinks
// before the video is allowed past SHORTS_MAX_SEC.
const SHORTS_MAX_SEC = 176;
const MAX_TEMPO = 1.15;
const END_TAIL_SEC = 2.5;
const MIN_TAIL_SEC = 0.8;

/**
 * How to fit `durSec` of narration into a Short: { tempo, tailSec, fits }.
 * `fits` is false when even the fastest tempo and shortest tail run over —
 * the caller should ask for a shorter story rather than post a non-Short.
 */
function fitShort(durSec) {
  const tempo = Math.min(MAX_TEMPO, Math.max(1, durSec / (SHORTS_MAX_SEC - END_TAIL_SEC)));
  const tailSec = Math.max(MIN_TAIL_SEC, Math.min(END_TAIL_SEC, SHORTS_MAX_SEC - durSec / tempo));
  return { tempo, tailSec, fits: durSec / tempo + tailSec <= SHORTS_MAX_SEC + 0.05 };
}

// The look of the devotional art, picked by DEVOTIONAL_STYLE (a GitHub
// Actions variable) for the daily Shorts, and per series for the landscape
// episodes (build-landscape-episode.js):
//   cartoon3d (default) — a clean 3D animated-feature look, the style of the
//     channel's best "Divine Bal Krishna … Cinematic AI Animation" reels.
//     Image models draw this crisply and consistently; faces, hands and the
//     blue-skinned deities hold up far better than in photoreal.
//   cartoon2d — hand-painted 2D animation, like classic devotional cartoons.
//   realistic — a live-action mythological epic film still.
const ART_STYLES = {
  cartoon3d: 'high-quality 3D animated feature film still, cute expressive characters with big gentle eyes, smooth ' +
    'clean shapes, crisp sharp details, vibrant saturated colours, soft global illumination and warm rim light, ' +
    'rich detailed background',
  cartoon2d: 'beautiful hand-painted 2D animation still in the style of a classic Indian devotional cartoon, clean ' +
    'bold outlines, flat vibrant colours with soft shading, crisp and clear, lush detailed background',
  realistic: 'photorealistic cinematic film still from a big-budget Indian mythological epic, lifelike faces and ' +
    'natural skin texture, authentic costumes and jewellery, volumetric golden light, shallow depth of field, 35mm ' +
    'lens, highly detailed',
};
const STYLE_KEYS = Object.keys(ART_STYLES);

/** A valid style key from `value`, or null. */
function styleKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return STYLE_KEYS.includes(key) ? key : null;
}

/** Prompt text for `style` (falls back to cartoon3d), framed for a tall
 *  Short or a widescreen episode. */
function artStyleFor(style, { orientation = 'vertical' } = {}) {
  const framing = orientation === 'wide' ? 'widescreen 16:9 composition' : 'vertical composition';
  return `${ART_STYLES[styleKey(style) || 'cartoon3d']}, ${framing}, no text, no words`;
}

/** The daily Shorts' style, from DEVOTIONAL_STYLE. */
function devotionalArtStyle(opts) {
  return artStyleFor(process.env.DEVOTIONAL_STYLE, opts);
}

module.exports = { styleOfDay, fitShort, devotionalArtStyle, artStyleFor, styleKey, STYLE_KEYS, SHORTS_MAX_SEC, MAX_TEMPO };
