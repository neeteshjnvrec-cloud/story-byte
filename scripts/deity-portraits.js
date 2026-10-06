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
 * PORTRAIT_CANDIDATES (per key, default 2), CLOUDFLARE_ACCOUNT_ID/_API_TOKEN.
 * Each portrait is ~4 tiles of FLUX.2 [klein] (~100 neurons of the free
 * 10,000/day), so the default set is roughly 4,000 — run it on its own day.
 */
const fs = require('fs');
const path = require('path');
const { FIGURES } = require('./lib/iconography');
const { fetchCloudflareHQImage } = require('./lib/cloudflare-image');
const { devotionalArtStyle } = require('./lib/short-style');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'deity-candidates');
const DEFAULT_KEYS = ['balkrishna', 'krishna', 'radha', 'shiva', 'parvati', 'ganesha', 'hanuman', 'ram', 'sita',
  'vishnu', 'lakshmi', 'durga', 'shani', 'kartikeya', 'saraswati', 'shailputri', 'brahmacharini', 'chandraghanta',
  'kushmanda', 'skandamata', 'katyayani', 'kalaratri', 'mahagauri', 'siddhidatri'];

async function main() {
  const keys = (process.env.PORTRAIT_KEYS || DEFAULT_KEYS.join(',')).split(',').map((k) => k.trim()).filter(Boolean);
  const count = Math.max(1, Math.min(4, Number(process.env.PORTRAIT_CANDIDATES || 2)));
  fs.mkdirSync(OUT, { recursive: true });
  let ok = 0;
  for (const key of keys) {
    const figure = FIGURES.find((f) => f.key === key);
    if (!figure) { console.warn(`Unknown key "${key}" — see lib/iconography.js`); continue; }
    // In the same style the daily videos use (DEVOTIONAL_STYLE), so an
    // approved portrait matches the scenes it guides.
    const prompt = `${figure.look}. A full-figure devotional portrait, front-facing, centred, calm divine expression, ` +
      `temple sanctum background softly out of focus, ${devotionalArtStyle()}`;
    for (let n = 1; n <= count; n++) {
      try {
        // Variation between candidates comes from the model itself; a short
        // suffix keeps the requests distinct.
        const image = await fetchCloudflareHQImage(n === 1 ? prompt : `${prompt}, variation ${n}`, { width: 768, height: 1024 });
        fs.writeFileSync(path.join(OUT, `${key}-${n}.jpg`), image);
        ok += 1;
        console.log(`✓ ${key}-${n}`);
      } catch (e) {
        console.warn(`✗ ${key}-${n}: ${e.message}`);
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'README.txt'), [
    'Candidate reference portraits. To approve one, rename it to <key>.jpg (e.g. hanuman.jpg)',
    'and add it to assets/deities/ in the repository. Your own preferred image works too.',
  ].join('\n'));
  console.log(`${ok} portrait(s) written to deity-candidates/`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
