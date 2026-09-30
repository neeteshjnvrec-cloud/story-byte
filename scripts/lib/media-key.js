/**
 * Folder name under public/instagram/ for a story's social media files
 * (slides, Reel/Short, scene art). Instagram's media fetcher can't download
 * a video_url/image_url whose path has non-ASCII characters in it — every
 * Hindi story (whose id carries a Devanagari title slug) failed there with
 * "container ... failed processing" (Reel) and "Only photo or video can be
 * accepted as media type" (carousel), while English stories and Facebook
 * were fine. ASCII ids are kept as they are; anything else keeps its ASCII
 * part (date, language, genre — what prune-old-videos.js dates folders by)
 * plus a short hash of the full id, so it stays unique.
 */
const crypto = require('crypto');

function mediaKey(id) {
  const s = String(id);
  if (/^[A-Za-z0-9._-]+$/.test(s)) return s;
  const ascii = s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/[-_]+$/, '');
  return `${ascii}_${crypto.createHash('md5').update(s).digest('hex').slice(0, 8)}`;
}

module.exports = { mediaKey };
