// The YouTube video player above every screen (context/VideoContext.js): laid
// over its story page's video space while that page is open, and a small
// floating window on every other screen, so leaving the page doesn't stop
// the video. One WebView throughout, only resized, so it never reloads.
//
// The mini window: tap to go back to the story page; pause/play and close
// buttons. A story's audio and the video never talk over each other: the
// video starting pauses the audio, and the audio starting pauses the video.
import React, { useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';
import { useAudioPlayer } from '../context/AudioContext';
import { YouTubePlayer } from './story/YouTubePlayer';
import { Icon } from './ui/Icon';

const MINI_WIDTH = 192;
const MINI_HEIGHT = Math.round((MINI_WIDTH * 9) / 16);
// FloatingAudioPlayer's bar: 60 above the bottom inset, ~62 tall.
const AUDIO_BAR_SPACE = 72;

const control = (webView, call) => webView.current?.injectJavaScript(`window.sbPlayer && window.sbPlayer.${call}(); true;`);

export function FloatingVideoPlayer({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const { video, mode, frame, playing, closeVideo, onPlayerEvent } = useVideo();
  const { isPlaying: audioPlaying, playPause: audioPlayPause, currentStory: audioStory } = useAudioPlayer();
  const webView = useRef(null);
  const audioWas = useRef(audioPlaying);
  const audioRef = useRef({ audioPlaying, audioPlayPause });
  audioRef.current = { audioPlaying, audioPlayPause };

  // The audio starting (from its mini bar, or another story) pauses the video.
  useEffect(() => {
    if (audioPlaying && !audioWas.current && playing) control(webView, 'pauseVideo');
    audioWas.current = audioPlaying;
  }, [audioPlaying, playing]);

  if (!video || (mode === 'inline' && !frame)) return null;

  const onEvent = (e) => {
    if (e.type === 'play' && audioRef.current.audioPlaying) audioRef.current.audioPlayPause();
    onPlayerEvent(e);
  };

  const mini = mode === 'mini';
  const box = mini
    ? { right: 12, bottom: (insets.bottom || 10) + 60 + (audioStory ? AUDIO_BAR_SPACE : 0), width: MINI_WIDTH, height: MINI_HEIGHT }
    : { left: frame.x, top: frame.y, width: frame.width, height: frame.height };

  return (
    <View style={[styles.box, box, mini && styles.miniShadow]} pointerEvents="box-none">
      {/* Always the first child, so switching modes never remounts it. */}
      <YouTubePlayer
        videoId={video.videoId}
        width={box.width}
        radius={mini ? 12 : 22}
        webViewRef={webView}
        onEvent={onEvent}
      />
      {mini ? (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => navigationRef.current?.dispatch(StackActions.push('StoryDetail', { storyId: video.story.id, story: video.story }))}
            accessibilityRole="button"
            accessibilityLabel={`${video.story.title}, open video`}
          />
          <View style={styles.controls}>
            <Pressable
              onPress={() => control(webView, playing ? 'pauseVideo' : 'playVideo')}
              hitSlop={8}
              style={styles.btn}
              accessibilityLabel={playing ? 'Pause video' : 'Play video'}
            >
              <Icon name={playing ? 'pause' : 'play'} size={16} color="#fff" />
            </Pressable>
            <Pressable onPress={closeVideo} hitSlop={8} style={styles.btn} accessibilityLabel="Close video">
              <Icon name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', zIndex: 1001 },
  miniShadow: {
    borderRadius: 12, backgroundColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  controls: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 6 },
  btn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
});

export default FloatingVideoPlayer;
