/**
 * Deletes rendered .mp4 files older than a day (default) from public/ so
 * the repo and every Firebase Hosting deploy stop carrying every video ever
 * made. Nothing reads these after posting — Instagram, Facebook and YouTube
 * keep their own copies, and the app plays the separate audio files, which
 * are never touched here.
 *
 * Age comes from each folder's own name or metadata, never file mtimes (a
 * fresh CI checkout stamps every file with the checkout time):
 *   public/instagram/2026-09-24_...        -> that UTC date
 *   public/instagram/community_<ms>_...    -> that timestamp
 *   public/episodes/<series>/season-S/episode-N/ -> story.json `renderedAt`
 * A folder that can't be dated is left alone, except an episode with no
 * `renderedAt` — those all predate the field, so they're old by definition.
 *
 * Usage: node scripts/prune-old-videos.js [maxAgeHours=24]
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.resolve(__dirname, '..', 'public');
const maxAgeHours = Number(process.argv[2] || 24);
const cutoff = Date.now() - maxAgeHours * 3600 * 1000;

function subdirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(dir, d.name));
  } catch {
    return [];
  }
}

function socialFolderTime(dir) {
  const name = path.basename(dir);
  const date = name.match(/^(\d{4})-(\d{2})-(\d{2})_/);
  if (date) return Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]));
  const community = name.match(/^community_(\d{13})_/);
  if (community) return Number(community[1]);
  return null;
}

function episodeFolderTime(dir) {
  try {
    const renderedAt = JSON.parse(fs.readFileSync(path.join(dir, 'story.json'), 'utf8')).renderedAt;
    const t = Date.parse(renderedAt);
    return Number.isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

const folders = [
  ...subdirs(path.join(PUBLIC, 'instagram')).map((dir) => ({ dir, time: socialFolderTime(dir) })),
  // season-S/episode-N, or a bare episode-N from before seasons existed.
  ...subdirs(path.join(PUBLIC, 'episodes'))
    .flatMap(subdirs)
    .flatMap((dir) => (/^season-\d+$/.test(path.basename(dir)) ? subdirs(dir) : [dir]))
    .map((dir) => ({ dir, time: episodeFolderTime(dir) })),
];

let removed = 0;
let bytes = 0;
for (const { dir, time } of folders) {
  if (time === null || time >= cutoff) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.mp4')) continue;
    const full = path.join(dir, file);
    bytes += fs.statSync(full).size;
    fs.rmSync(full);
    removed += 1;
  }
}

console.log(`Pruned ${removed} video(s) older than ${maxAgeHours}h (${(bytes / 1e6).toFixed(1)} MB).`);
