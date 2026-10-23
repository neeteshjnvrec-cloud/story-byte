/**
 * Generate the 4 Browse "vertical" banner images (Pollinations, free) and
 * deploy them to Firebase Hosting at /verticals/<key>.jpg.
 */
const { execFileSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { FIREBASE_TOOLS } = require('./lib/firebase-cli');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const SA = path.join(ROOT, 'functions/firebase-service-account.json');
const PROJECT = 'storybyte-76716';

const VERTICALS = {
  fiction: 'A stack of open books with glowing magical stories drifting out, adventure and mystery, storybook cover illustration, warm cinematic, painterly, no text no words',
  bedtime: 'Peaceful moonlit night sky full of soft stars over a cozy sleeping village, calm dreamy bedtime, deep indigo and warm glow, painterly, no text no words',
  kids: 'Bright cheerful cartoon of friendly animals and happy children on a colorful adventure, playful storybook, vivid warm colors, no text no words',
  hindi: 'Warm Indian storytelling evening with glowing diyas and marigold flowers, cozy traditional, golden saffron tones, painterly illustration, no text no words',
};

function fetchImage(url, out) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(out);
    https.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      res.pipe(f); f.on('finish', () => f.close(() => resolve()));
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}
const seed = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000; return h; };

(async () => {
  fs.mkdirSync(path.join(PUB, 'verticals'), { recursive: true });
  for (const [key, prompt] of Object.entries(VERTICALS)) {
    const out = path.join(PUB, 'verticals', `${key}.jpg`);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=640&nologo=true&seed=${seed(key)}&model=flux`;
    await fetchImage(url, out);
    console.log('cover ✓', key, `(${Math.round(fs.statSync(out).size / 1024)}KB)`);
  }
  console.log('deploying to Firebase Hosting…');
  execFileSync('npx', ['--yes', FIREBASE_TOOLS, 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SA } });
  console.log('Done. Vertical banners live at https://' + PROJECT + '.web.app/verticals/<key>.jpg');
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
