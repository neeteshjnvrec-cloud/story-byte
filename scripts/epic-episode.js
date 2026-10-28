/**
 * The next episode of an epic series (EPIC, default "ramayan": its plan is
 * scripts/epics/<EPIC>.js), rendered by build-landscape-episode.js in epic
 * mode. Run Mon/Wed/Fri by .github/workflows/ramayan.yml.
 *
 * The next episode is the one after the highest already saved in
 * public/episodes/<series>/season-1/: a failed run commits nothing, so the
 * next run makes the same episode again. EPIC_EPISODE picks one by hand
 * (e.g. to remake it). With PUBLISH_HOUR_IST set (e.g. 10), the YouTube
 * video goes public at that hour today, India time, however long the render
 * took; past that hour it goes public right away.
 *
 * Env: everything build-landscape-episode.js takes.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEY = String(process.env.EPIC || 'ramayan').trim();
const epic = require(`./epics/${KEY}`);
const seasonDir = path.resolve(__dirname, '..', 'public', 'episodes', epic.key, 'season-1');

function lastSaved() {
  if (!fs.existsSync(seasonDir)) return 0;
  return fs.readdirSync(seasonDir)
    .filter((d) => fs.existsSync(path.join(seasonDir, d, 'story.json')))
    .map((d) => Number((d.match(/^episode-(\d+)$/) || [])[1]) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
}

/** Today at `hour`:00 India time, as an ISO string. */
function todayAtIst(hour) {
  const ist = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  return new Date(`${ist}T${String(hour).padStart(2, '0')}:00:00+05:30`).toISOString();
}

function main() {
  const chosen = String(process.env.EPIC_EPISODE || '').trim();
  const n = chosen ? Number(chosen) : lastSaved() + 1;
  if (n > epic.episodes.length) {
    console.log(`📖 ${epic.name}: all ${epic.episodes.length} episodes are done.`);
    return;
  }
  const hour = Number(process.env.PUBLISH_HOUR_IST);
  const publishAt = Number.isFinite(hour) && hour > 0 ? todayAtIst(hour) : '';
  console.log(`📖 ${epic.name} episode ${n}/${epic.episodes.length}: ${epic.episodes[n - 1].title}` +
    (publishAt ? ` (public on YouTube at ${publishAt})` : ''));
  execFileSync('node', [path.join(__dirname, 'build-landscape-episode.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EPISODE_TITLE: epic.title,
      EPISODE_SEASON: '1',
      EPISODE_NUMBER: String(n),
      EPISODE_LANGUAGE: 'hi',
      EPISODE_GENRE: 'devotional mythology',
      EPISODE_EPIC: epic.key,
      EPISODE_PUBLISH_AT: publishAt,
      // The art style is kept in the series bible from the first episode, so
      // the look doesn't change mid-series; EPISODE_STYLE overrides it.
    },
  });
}

main();
