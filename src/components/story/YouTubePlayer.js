// YouTube's embedded player (allowed by YouTube; views and ads count as
// usual), used by the story details screen for long stories. The player runs
// in our website's watch page (public/watch.html, built by
// scripts/lib/site-index.js), which gives YouTube the embedding site it
// requires and shows the video's thumbnail until the video is ready.
import React from 'react';
import { View, Image, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const PLAYER_PAGE = 'https://storybyte-76716.web.app/watch';
const PLAYER_BG = '#000';

// Shown while the watch page itself loads: the same thumbnail and spinner
// the page then shows until YouTube's player is ready.
function PlayerLoading({ videoId, poster }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.loading]}>
      <Image
        source={{ uri: poster || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}

/**
 * vertical: a Short (9:16) instead of a 16:9 video.
 * poster: the thumbnail until the video is ready (our own story cover for a
 *   Short, since YouTube's Short thumbnails are letterboxed); YouTube's
 *   thumbnail otherwise.
 * autoplay: start playing as soon as it's ready (off for a Short on a story
 *   page, where the story's audio may be playing).
 */
export function YouTubePlayer({ videoId, width, radius = 0, style, vertical = false, poster, autoplay = true }) {
  const height = Math.round(vertical ? (width * 16) / 9 : (width * 9) / 16);
  const params = [`v=${encodeURIComponent(videoId)}`];
  if (!autoplay) params.push('autoplay=0');
  if (poster) params.push(`poster=${encodeURIComponent(poster)}`);
  return (
    <View style={[{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: PLAYER_BG }, style]}>
      <WebView
        source={{ uri: `${PLAYER_PAGE}?${params.join('&')}` }}
        style={{ flex: 1, backgroundColor: PLAYER_BG }}
        startInLoadingState
        renderLoading={() => <PlayerLoading videoId={videoId} poster={poster} />}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        // Links out of the player (YouTube logo, "more videos") open the
        // YouTube app instead of taking over the screen.
        onShouldStartLoadWithRequest={(req) => {
          // The YouTube player's own frame (iOS asks about frames too).
          if (req.isTopFrame === false) return true;
          if (req.url.startsWith(PLAYER_PAGE) || req.url.startsWith('https://www.youtube.com/embed/') || req.url === 'about:blank') return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center', backgroundColor: PLAYER_BG },
});

export default YouTubePlayer;
