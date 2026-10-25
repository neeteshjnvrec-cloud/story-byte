/**
 * Generates candidate reference portraits of each deity, drawn from their
 * traditional iconography (lib/iconography.js), for you to review. Approve
 * one by saving it as assets/deities/<key>.jpg — from then on every daily
 * scene showing that figure is generated with it as a reference image, so
 * Hanuman always looks like the approved Hanuman (see lib/video-scenes.js).
 *
 * Outputs deity-candidates/<key>-<n>.jpg (uploaded as a run artifact by the
 * Deity Portraits workflow); nothing is committed or posted.
 *
 * Env: PORTRAIT_KEYS (comma-separated keys; default: the main deities),
 * PORTRAIT_CANDIDATES (per key and model, default 2), PORTRAIT_MODELS
 * (comma-separated: 4b, 9b, gemini; default 4b), CLOUDFLARE_ACCOUNT_ID/_API_TOKEN,
 * GEMINI_API_KEY for gemini (lib/gemini-image.js: the sharpest, from Google's
 * own quota, not Cloudflare's).
 * A 4b portrait is ~100 neurons of the free 10,000/day per account; a 9b one
 * ~1,400, so 15 deities with one 9b candidate each is ~21,000 — run it after
 * the daily run, when the day's allocation is fresh.
 */
const fs = require('fs');
const path = require('path');
const { FIGURES } = require('./lib/iconography');
const { fetchCloudflareHQImage } = require('./lib/cloudflare-image');
const { devotionalArtStyle } = require('./lib/short-style');
const { checkImage } = require('./lib/image-check');
const { fetchGeminiImage } = require('./lib/gemini-image');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'deity-candidates');
const DEFAULT_KEYS = ['balkrishna', 'krishna', 'radha', 'shiva', 'parvati', 'ganesha', 'hanuman', 'ram', 'sita',
  'vishnu', 'lakshmi', 'durga', 'shani', 'kartikeya', 'saraswati', 'shailputri', 'brahmacharini', 'chandraghanta',
  'kushmanda', 'skandamata', 'katyayani', 'kalaratri', 'mahagauri', 'siddhidatri'];
const MODELS = { '4b': '@cf/black-forest-labs/flux-2-klein-4b', '9b': '@cf/black-forest-labs/flux-2-klein-9b', gemini: 'gemini' };

async function main() {
  const keys = (process.env.PORTRAIT_KEYS || DEFAULT_KEYS.join(',')).split(',').map((k) => k.trim()).filter(Boolean);
  const count = Math.max(1, Math.min(4, Number(process.env.PORTRAIT_CANDIDATES || 2)));
  const models = (process.env.PORTRAIT_MODELS || '4b').split(',').map((m) => m.trim()).filter((m) => MODELS[m]);
  if (!models.length) models.push('4b');
  fs.mkdirSync(OUT, { recursive: true });
  let ok = 0;
  const verdicts = [];
  for (const key of keys) {
    const figure = FIGURES.find((f) => f.key === key);
    if (!figure) { console.warn(`Unknown key "${key}" — see lib/iconography.js`); continue; }
    // In the same style the daily videos use (DEVOTIONAL_STYLE), so an
    // approved portrait matches the scenes it guides.
    const prompt = `${figure.look}. A full-figure devotional portrait, front-facing, centred, calm divine expression, ` +
      `temple sanctum background softly out of focus, ${devotionalArtStyle()}`;
    for (const m of models) for (let n = 1; n <= count; n++) {
      // Named by model, so the candidates compare the models side by side.
      const name = `${key}-${m}-${n}`;
      try {
        // Variation between candidates comes from the model itself; a short
        // suffix keeps the requests distinct.
        const ask = n === 1 ? prompt : `${prompt}, variation ${n}`;
        const image = m === 'gemini'
          ? await fetchGeminiImage(`${ask}. Anatomically correct, natural hands, no text. Vertical portrait.`, { aspectRatio: '3:4' })
          : await fetchCloudflareHQImage(ask, { width: 768, height: 1024, model: MODELS[m] });
        fs.writeFileSync(path.join(OUT, `${name}.jpg`), image);
        ok += 1;
        // The picture check's verdict, to help pick (and to try the check).
        const v = await checkImage(image, { subject: `a devotional portrait of ${figure.look.split(':')[0]}`, looks: figure.look });
        const note = v ? `${v.ok ? 'passed' : 'FAILED'} (${v.score}/10, ${v.checker})${v.problems.length ? `: ${v.problems.join('; ')}` : ''}` : 'unchecked';
        verdicts.push(`${name}.jpg — ${note}`);
        console.log(`✓ ${name} — check ${note}`);
      } catch (e) {
        console.warn(`✗ ${name}: ${e.message}`);
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'README.txt'), [
    'Candidate reference portraits, named <key>-<model>-<n>.jpg. To approve one, rename it to <key>.jpg (e.g. hanuman.jpg)',
    'and add it to assets/deities/ in the repository. Your own preferred image works too.',
    '', 'Picture check:', ...verdicts,
  ].join('\n'));
  console.log(`${ok} portrait(s) written to deity-candidates/`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
