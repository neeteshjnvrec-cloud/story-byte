/**
 * The next episode of an epic series (EPIC, default "ramayan": its plan is
 * scripts/epics/<EPIC>.js), rendered by build-landscape-episode.js in epic
 * mode. Run by .github/workflows/ramayan.yml (Mon/Wed/Fri) and
 * life-of-jesus.yml (Tue/Thu/Sat, on its own YouTube channel).
 *
 * The next episode is the one after the highest already published (see
 * lastDone), so after a failed run the next run makes the same episode again. EPIC_EPISODE picks one by hand
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
// build-landscape-episode.js names the folder from the title.
if (epic.key !== epic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')) throw new Error(`epics/${KEY}.js: key must be the title's slug`);
const seasonDir = path.resolve(__dirname, '..', 'public', 'episodes', epic.key, 'season-1');

/** The highest episode already done: on YouTube when publishing (the save
 *  step also commits a failed upload's story.json, and that episode must
 *  be made again), else just rendered. */
function lastDone() {
  if (!fs.existsSync(seasonDir)) return 0;
  const publishing = process.env.EPISODE_PUBLISH === 'true';
  return fs.readdirSync(seasonDir)
    .filter((d) => {
      try {
        const story = JSON.parse(fs.readFileSync(path.join(seasonDir, d, 'story.json'), 'utf8'));
        return !publishing || story.published?.youtube?.posted;
      } catch {
        return false;
      }
    })
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
  const n = chosen ? Number(chosen) : lastDone() + 1;
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
      EPISODE_LANGUAGE: epic.language,
      EPISODE_GENRE: epic.genre,
      EPISODE_EPIC: epic.key,
      EPISODE_PUBLISH_AT: publishAt,
      EPISODE_VOICE: epic.voice || '',
      // A plan's own style (the Life of Jesus: realistic) is used every time;
      // otherwise the style kept in the series bible from the first episode,
      // so the look doesn't change mid-series. EPISODE_STYLE overrides both.
      EPISODE_STYLE: String(process.env.EPISODE_STYLE || '').trim() || epic.style || '',
    },
  });
}

main();
