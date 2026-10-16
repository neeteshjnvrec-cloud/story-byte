// The YouTube video player above every screen (context/VideoContext.js): laid
// over its story page's video space while that page is open, and a small
// floating window on every other screen, so leaving the page doesn't stop
// the video. One WebView throughout, only resized, so it never reloads.
//
// The mini window: drag it anywhere (it settles against the nearer side),
// tap it to open the story page, and pause/play or close it with its
// buttons. A story's audio and the video never talk over each other: the
// video starting pauses the audio, and the audio starting pauses the video.
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated, PanResponder, useWindowDimensions } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideo } from '../context/VideoContext';
import { useAudioPlayer } from '../context/AudioContext';
import { YouTubePlayer } from './story/YouTubePlayer';
import { Icon } from './ui/Icon';

const MINI_WIDTH = 192;
const MINI_HEIGHT = Math.round((MINI_WIDTH * 9) / 16);
const EDGE = 12;
// FloatingAudioPlayer's bar: 60 above the bottom inset, ~62 tall.
const AUDIO_BAR_SPACE = 72;

/**
 * Calls the YouTube player in the watch page: window.sbPlayer when the page
 * has it, else a command posted straight to YouTube's frame (its IFrame API
 * accepts them), which works with any version of the watch page.
 */
function control(webView, func, args = []) {
  const call = JSON.stringify({ event: 'command', func, args });
  webView.current?.injectJavaScript(`(function () { try {
    if (window.sbPlayer && window.sbPlayer.${func}) { window.sbPlayer.${func}.apply(window.sbPlayer, ${JSON.stringify(args)}); return; }
    var f = document.querySelector('iframe');
    if (f && f.contentWindow) f.contentWindow.postMessage(${JSON.stringify(call)}, '*');
  } catch (e) {} })(); true;`);
}

export function FloatingVideoPlayer({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { video, mode, frame, playing, closeVideo, onPlayerEvent } = useVideo();
  const { isPlaying: audioPlaying, playPause: audioPlayPause, currentStory: audioStory } = useAudioPlayer();
  const webView = useRef(null);
  const audioWas = useRef(audioPlaying);
  const audioRef = useRef({ audioPlaying, audioPlayPause });
  audioRef.current = { audioPlaying, audioPlayPause };
  const unmuted = useRef(null);

  // The audio starting (from its mini bar, or another story) pauses the video.
  useEffect(() => {
    if (audioPlaying && !audioWas.current && playing) control(webView, 'pauseVideo');
    audioWas.current = audioPlaying;
  }, [audioPlaying, playing]);

  // Where the mini window rests (bottom right, above the tab bar and the
  // audio bar), and how far it may be dragged from there.
  const restBottom = (insets.bottom || 10) + 60 + (audioStory ? AUDIO_BAR_SPACE : 0);
  const limits = useRef({});
  limits.current = {
    minX: -(screenW - MINI_WIDTH - 2 * EDGE),
    maxX: 0,
    minY: -(screenH - restBottom - MINI_HEIGHT - insets.top - EDGE),
    maxY: restBottom - (insets.bottom + EDGE),
  };
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const at = useRef({ x: 0, y: 0 });
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const responder = useMemo(() => PanResponder.create({
    // A tap stays a tap (opens the page); only a real drag moves the window.
    onMoveShouldSetPanResponderCapture: (e, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
    onPanResponderMove: (e, g) => {
      const l = limits.current;
      pan.setValue({ x: clamp(at.current.x + g.dx, l.minX, l.maxX), y: clamp(at.current.y + g.dy, l.minY, l.maxY) });
    },
    onPanResponderRelease: (e, g) => {
      const l = limits.current;
      const x = clamp(at.current.x + g.dx, l.minX, l.maxX);
      const y = clamp(at.current.y + g.dy, l.minY, l.maxY);
      // Settle against the nearer side, like picture-in-picture.
      at.current = { x: x < l.minX / 2 ? l.minX : 0, y };
      Animated.spring(pan, { toValue: at.current, useNativeDriver: false, friction: 7 }).start();
    },
    onPanResponderTerminationRequest: () => false,
  }), [pan]);

  if (!video || (mode === 'inline' && !frame)) return null;

  const onEvent = (e) => {
    if (e.type === 'play') {
      if (audioRef.current.audioPlaying) audioRef.current.audioPlayPause();
      // YouTube mutes a video that starts by itself; the app may play sound
      // without a tap, so turn it on — once per video, so muting it stays.
      if (unmuted.current !== video.videoId) {
        unmuted.current = video.videoId;
        control(webView, 'unMute');
        control(webView, 'setVolume', [100]);
      }
    }
    onPlayerEvent(e);
  };

  const mini = mode === 'mini';
  const box = mini
    ? { right: EDGE, bottom: restBottom, width: MINI_WIDTH, height: MINI_HEIGHT }
    : { left: frame.x, top: frame.y, width: frame.width, height: frame.height };

  return (
    <Animated.View
      style={[styles.box, box, mini && styles.miniShadow, { transform: mini ? pan.getTranslateTransform() : [] }]}
      pointerEvents="box-none"
      {...(mini ? responder.panHandlers : {})}
    >
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', zIndex: 1001 },
  miniShadow: {
    borderRadius: 12, backgroundColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  controls: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 6 },
  btn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
});

export default FloatingVideoPlayer;
