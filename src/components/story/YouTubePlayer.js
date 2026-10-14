// YouTube's embedded player (allowed by YouTube; views and ads count as
// usual), used by the story details screen for long stories. The player runs
// in our website's watch page (public/watch.html, built by
// scripts/lib/site-index.js), which gives YouTube the embedding site it
// requires and shows a StoryByte loading screen until the video is ready.
import React from 'react';
import { View, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { AppText } from '../ui/AppText';

const PLAYER_PAGE = 'https://storybyte-76716.web.app/watch';
// The watch page's own loading-screen colour, so the hand-over from this
// native loader to the page's is seamless.
const PLAYER_BG = '#120c08';

// Shown while the watch page itself loads.
function PlayerLoading() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.loading]}>
      <View style={styles.mark}><AppText style={styles.markText}>S</AppText></View>
      <ActivityIndicator color="#E0913A" style={{ marginTop: 14 }} />
    </View>
  );
}

export function YouTubePlayer({ videoId, width, radius = 0, style }) {
  return (
    <View style={[{ width, height: Math.round((width * 9) / 16), borderRadius: radius, overflow: 'hidden', backgroundColor: PLAYER_BG }, style]}>
      <WebView
        source={{ uri: `${PLAYER_PAGE}?v=${encodeURIComponent(videoId)}` }}
        style={{ flex: 1, backgroundColor: PLAYER_BG }}
        startInLoadingState
        renderLoading={() => <PlayerLoading />}
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
  mark: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C9773A' },
  markText: { color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 30 },
});

export default YouTubePlayer;
