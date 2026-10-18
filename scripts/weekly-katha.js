/**
 * The weekly long katha video: picks this week's katha and renders it with
 * the landscape engine in katha mode (build-landscape-episode.js), a
 * ~15-minute 16:9 retelling under the Hindi title people search for,
 * published to YouTube and Facebook.
 *
 * A festival on that Sunday or in the week after it (occasions.js) takes
 * the week, with its best-known katha: "करवा चौथ की कथा" is what people
 * search for that week, and a long video needs a few days to be found.
 * Otherwise the deity rotates week by week through the seven weekday
 * deities, and the katha is a different one from the deity's Short that
 * week, so the long video never repeats the Short.
 *
 * Env: everything build-landscape-episode.js takes. KATHA_DEITY (a key such
 * as "hanuman") and KATHA_INDEX pick the katha by hand instead.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { DEITIES, festivalOfWeek, istDate } = require('./lib/devotional-calendar');
const { devotionalTrends } = require('./lib/trends');

function pick(now = new Date()) {
  const choosing = process.env.KATHA_DEITY || (process.env.KATHA_INDEX !== undefined && process.env.KATHA_INDEX !== '');
  const festival = !choosing && festivalOfWeek(istDate(now));
  if (festival) return festival;
  const week = Math.floor(now.getTime() / (7 * 86400000));
  const list = Object.values(DEITIES);
  const deity = list.find((d) => d.key === process.env.KATHA_DEITY) || list[week % list.length];
  // The daily Short uses kathas[week % n] (deityOfDay); halfway round the
  // list is a different story for at least the next few weeks.
  const index = process.env.KATHA_INDEX !== undefined && process.env.KATHA_INDEX !== ''
    ? Number(process.env.KATHA_INDEX) : week + Math.floor(deity.kathas.length / 2);
  return { deity, katha: deity.kathas[index % deity.kathas.length] };
}

async function main() {
  const { deity, katha } = pick();
  console.log(`📿 This week's long katha: ${deity.name} — ${katha}`);
  const trends = await devotionalTrends([`${deity.hindi} की कथा`, deity.hindi]);
  console.log(`📈 Searches: ${trends.searches.join(' | ') || 'none'}`);
  const date = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  execFileSync('node', [path.join(__dirname, 'build-landscape-episode.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EPISODE_TITLE: 'Bhakti Katha',
      EPISODE_SEASON: date.slice(0, 4),
      EPISODE_NUMBER: date.replace(/-/g, '').slice(4),
      EPISODE_LANGUAGE: 'hi',
      EPISODE_GENRE: 'devotional mythology',
      EPISODE_KATHA: katha,
      EPISODE_DEITY: deity.hindi,
      EPISODE_SEARCHES: trends.searches.join('\n'),
      EPISODE_HASHTAGS: deity.hashtags.join(' '),
    },
  });
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { pick };
