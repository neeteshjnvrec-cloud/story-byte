// Share a story to the OS share sheet.
//
// Everything is packed into a single `message` string on purpose. Passing
// `message` AND `url` together hands iOS two separate activity items, and any
// target that wants one string receives the archived property list instead —
// which is why shared text arrived as percent-encoded `bplist00…` garbage with
// the real URL buried inside it.
import { Share } from 'react-native';

// The app is live on Play; there's no iOS listing yet, so both platforms get
// this. Used as the share fallback when a story has no page of its own.
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.storybyte.app';

export async function shareStory(story) {
  if (!story) return { shared: false };

  const title = story.title || 'A story on StoryByte';
  const author = (story.authorName || story.author || '').trim();
  const description = (story.description || '').trim();

  // The story's own page: cover, title, author, transcript, a player and a
  // Get-the-app button, with the OpenGraph tags that make it preview as a rich
  // card. This used to be `story.audioUrl`, which sent recipients a bare MP3
  // download with no context and no way back to the app.
  //
  // `pageUrl` is absent for stories published before pages existed and for any
  // story still `under_review`, so fall back to the store link — a share that
  // points at the app still beats one with no link at all.
  const link = story.pageUrl || PLAY_STORE_URL;

  const parts = [author ? `"${title}" — by ${author}` : `"${title}"`];
  if (description) parts.push(description);
  // URL last so previews attach cleanly to the end of the message.
  parts.push(link);

  try {
    const result = await Share.share(
      // `title` is the Android chooser heading; iOS ignores it.
      { message: parts.join('\n\n'), title },
      // `subject` is what mail clients use for the subject line.
      { dialogTitle: 'Share story', subject: `"${title}" on StoryByte` }
    );
    return { shared: result.action === Share.sharedAction };
  } catch (e) {
    console.warn('[shareStory] failed:', e?.message);
    return { shared: false };
  }
}

export default shareStory;
