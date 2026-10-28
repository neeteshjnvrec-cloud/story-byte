// YouTube videos as stories (scripts/sync-video-stories.js):
//  - a long video: stories/yt_<id>, status "video", no audio; it plays in
//    YouTube's player on its story page.
//  - a daily story with a Short: normal audio story plus youtubeId and
//    youtubeKind "short"; its page also plays the Short.
//  - a community story of 3+ minutes: youtubeKind "long", a 16:9 video
//    (scripts/generate-community-audio.js); its page plays it wide.

/** A story that is only a video (nothing to play as audio). */
export const isVideoStory = (story) => !!story?.youtubeId && !story?.audioUrl;

/** An audio story's own YouTube video, { id, vertical }, or null: a Short
 *  plays in a tall player, a long (16:9) video in a wide one. */
export const storyVideoOf = (story) => (
  story?.audioUrl && story?.youtubeId && ['short', 'long'].includes(story?.youtubeKind)
    ? { id: story.youtubeId, vertical: story.youtubeKind === 'short' }
    : null
);

const millis = (t) => (t?.toMillis ? t.toMillis() : typeof t?.seconds === 'number' ? t.seconds * 1000 : Number(t) || 0);

/** Two story lists as one, newest first, without duplicates. */
export function mergeNewestFirst(a = [], b = []) {
  const seen = new Set();
  return [...a, ...b]
    .filter((s) => { const id = s.id || s.storyId; if (seen.has(id)) return false; seen.add(id); return true; })
    .sort((x, y) => millis(y.createdAt) - millis(x.createdAt));
}
