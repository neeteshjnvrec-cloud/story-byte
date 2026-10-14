// Long episodes are in the app as their text plus a YouTube link, with no
// audio of their own (scripts/lib/publish-episode-to-app.js). "Play" opens
// the video in YouTube instead.
import { Linking } from 'react-native';

export const isVideoOnly = (story) => !!story && !story.audioUrl && !!story.youtubeUrl;

export function openOnYouTube(story) {
  return Linking.openURL(story.youtubeUrl).catch(() => {});
}
