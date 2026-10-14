// Plays a long episode's YouTube video inside the app, with YouTube's own
// embedded player (allowed by YouTube; views and ads count as usual).
// The player runs in our website's watch page (public/watch.html), which
// gives YouTube the embedding site it requires.
import React, { useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Linking, useWindowDimensions, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';

const PLAYER_PAGE = 'https://storybyte-76716.web.app/watch';
// The player page's own loading screen colour (scripts/lib/site-index.js),
// so the hand-over from this native loader to the page's is seamless.
const PLAYER_BG = '#120c08';

// Shown while the player page itself loads; the page then shows the same
// StoryByte mark until YouTube's player is ready.
function PlayerLoading() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.loading]}>
      <View style={styles.mark}><AppText style={styles.markText}>S</AppText></View>
      <ActivityIndicator color="#E0913A" style={{ marginTop: 14 }} />
    </View>
  );
}

export function VideoScreen() {
  const { video } = useRoute().params || {};
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { isPlaying, playPause } = useAudioPlayer() || {};

  // A story playing in the background would talk over the video.
  useEffect(() => {
    if (isPlaying) playPause?.();
    // Only on opening the video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!video?.id) return null;
  const openInYouTube = () => Linking.openURL(video.youtubeUrl).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
      <View style={styles.head}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chev-left" />
        </Pressable>
        <AppText variant="label" numberOfLines={1} style={{ flex: 1 }}>{video.seriesTitle || 'Long story'}</AppText>
      </View>

      <View style={{ width, height: Math.round((width * 9) / 16), backgroundColor: PLAYER_BG }}>
        <WebView
          source={{ uri: `${PLAYER_PAGE}?v=${encodeURIComponent(video.id)}` }}
          style={{ flex: 1, backgroundColor: PLAYER_BG }}
          startInLoadingState
          renderLoading={() => <PlayerLoading />}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          // Links out of the player (YouTube logo, "more videos") open the
          // YouTube app instead of taking over this screen.
          onShouldStartLoadWithRequest={(req) => {
            // The YouTube player's own frame (iOS asks about frames too).
            if (req.isTopFrame === false) return true;
            if (req.url.startsWith(PLAYER_PAGE) || req.url.startsWith('https://www.youtube.com/embed/') || req.url === 'about:blank') return true;
            Linking.openURL(req.url).catch(() => {});
            return false;
          }}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 140 }}>
        <AppText variant="h2">{video.title}</AppText>
        {video.durationSec > 0 ? (
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 6 }}>
            {Math.round(video.durationSec / 60)} min
          </AppText>
        ) : null}
        {video.description ? (
          <AppText variant="bodyL" color="textSecondary" style={{ marginTop: 12, lineHeight: 25 }}>{video.description}</AppText>
        ) : null}
        <Button title="Open in YouTube" variant="ghost" leftIcon="play" onPress={openInYouTube} style={{ marginTop: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center', backgroundColor: PLAYER_BG },
  mark: {
    width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C9773A',
  },
  markText: { color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 30 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
});

export default VideoScreen;
