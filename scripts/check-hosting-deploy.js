/**
 * Safety check before a Firebase Hosting deploy run by hand (firebase.json
 * hosting.predeploy). A deploy replaces the whole website with the local
 * public/ folder, so it stops when that folder isn't what it should be:
 *
 *   1. Leftover files git doesn't keep (old Instagram media, episode audio
 *      and pictures from earlier runs …) would be uploaded too.
 *   2. Older than GitHub's main: a story the bot published since your last
 *      pull would disappear from the website, and stop playing in the app.
 *
 * Skipped in GitHub Actions, where the run's own fresh files (e.g. today's
 * Instagram video, which Instagram fetches from the website) must go up.
 * FORCE_DEPLOY=1 skips it by hand.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Files firebase.json's hosting.ignore already keeps off the website.
const HOSTING_IGNORED = [
  /(^|\/)\./, /(^|\/)node_modules\//,
  /^public\/episodes\/.*\.mp4$/, /^public\/episodes\/.*\/scene-[^/]*\.jpg$/, /^public\/episodes\/.*\/audio\.mp3$/,
];

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function main() {
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true' || process.env.FORCE_DEPLOY === '1') return 0;
  const problems = [];

  // 1. Files in public/ that git doesn't track (untracked or ignored).
  const extra = git('ls-files', '--others', '-z', 'public')
    .split('\0').filter(Boolean).filter((f) => !HOSTING_IGNORED.some((re) => re.test(f)));
  if (extra.length) {
    problems.push(
      `${extra.length} file(s) in public/ that aren't part of the repo would be uploaded, e.g.:\n` +
      extra.slice(0, 8).map((f) => `     ${f}`).join('\n') +
      '\n   Remove them with:  git clean -fdx public/'
    );
  }

  // 2. Behind GitHub's main in public/.
  try {
    git('fetch', '--quiet', 'origin', 'main');
    const newer = git('rev-list', '--count', 'HEAD..origin/main', '--', 'public').trim();
    if (Number(newer) > 0) {
      problems.push(
        `GitHub's main has ${newer} newer commit(s) with website files (e.g. today's stories) that this copy doesn't.\n` +
        '   Deploying would take them off the website. Update first:  git pull origin main'
      );
    }
  } catch (e) {
    console.warn('⚠️  Could not compare with GitHub (offline?); make sure you have the latest main.');
  }

  if (!problems.length) {
    console.log('✅ public/ matches the repo and is up to date');
    return 0;
  }
  console.error(`\n🛑 Hosting deploy stopped:\n\n - ${problems.join('\n\n - ')}\n\n` +
    '   (To deploy anyway: FORCE_DEPLOY=1 firebase deploy --only hosting)\n');
  return 1;
}

process.exitCode = main();
