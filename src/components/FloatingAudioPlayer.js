// FloatingAudioPlayer — a docked mini bar + a full-screen player modal,
// styled to the warm storybook design.
import React, { useState } from 'react';
import { View, Pressable, Modal, StyleSheet, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../hooks/useTheme';
import { AppText } from './ui/AppText';
import { Icon } from './ui/Icon';
import { Cover } from './story/Cover';

const fmtTime = (s) => {
  if (!s || s < 0) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const FloatingAudioPlayer = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    currentStory, progress, isPlaying, duration, currentPage, totalPages, speed,
    playPause, seek, seekForward, seekBackward, cycleSpeed, stop,
  } = useAudioPlayer();
  const [expanded, setExpanded] = useState(false);

  if (!currentStory) return null;

  const pos = (progress || 0) * (duration || 0);
  const pageText = currentStory.pages?.[currentPage]?.text || currentStory.text || currentStory.description || '';
  const miniBottom = (insets.bottom || 10) + 60;

  return (
    <>
      {/* Mini bar */}
      <Pressable
        onPress={() => setExpanded(true)}
        style={[styles.mini, { backgroundColor: theme.text, bottom: miniBottom }]}
        accessibilityRole="button"
        accessibilityLabel={`Now playing ${currentStory.title}. Open player.`}
      >
        <Cover story={currentStory} style={styles.miniCover} radius={11} />
        <View style={{ flex: 1 }}>
          <AppText variant="label" style={{ color: theme.background }} numberOfLines={1}>{currentStory.title}</AppText>
          <AppText variant="caption" style={{ color: theme.background, opacity: 0.7 }} numberOfLines={1}>
            {currentStory.genre || 'Story'}
          </AppText>
        </View>
        <Pressable onPress={playPause} hitSlop={10} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={24} color={theme.background} />
        </Pressable>
        <View style={[styles.miniBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <View style={{ width: `${Math.max(2, (progress || 0) * 100)}%`, height: '100%', backgroundColor: theme.secondary, borderRadius: 2 }} />
        </View>
      </Pressable>

      {/* Full player */}
      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View style={[styles.full, { backgroundColor: theme.background, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.fpHead}>
            <Pressable onPress={() => setExpanded(false)} hitSlop={10}><Icon name="chev-down" /></Pressable>
            <AppText variant="micro" color="textSecondary" style={{ letterSpacing: 1.2 }}>PLAYING FROM · STORYBYTE</AppText>
            <Pressable onPress={() => { stop(); setExpanded(false); }} hitSlop={10}><Icon name="close" /></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 26 }} showsVerticalScrollIndicator={false}>
            <Cover story={currentStory} style={styles.art} radius={24} />
            <AppText variant="h1" style={{ textAlign: 'center' }}>{currentStory.title}</AppText>
            {totalPages > 1 ? (
              <AppText variant="caption" color="accent" style={{ textAlign: 'center', marginTop: 4 }}>Page {currentPage + 1} of {totalPages}</AppText>
            ) : null}
            <AppText variant="body" color="textSecondary" style={{ textAlign: 'center', marginTop: 6 }} numberOfLines={2}>
              {currentStory.description || ''}
            </AppText>

            <Slider
              style={{ width: '100%', height: 40, marginTop: 18 }}
              minimumValue={0} maximumValue={1} value={progress || 0}
              onSlidingComplete={(v) => { if (duration > 0) seek(v * duration); }}
              minimumTrackTintColor={theme.accent} maximumTrackTintColor={theme.border} thumbTintColor={theme.accent}
            />
            <View style={styles.times}>
              <AppText variant="caption" color="textSecondary">{fmtTime(pos)}</AppText>
              <AppText variant="caption" color="textSecondary">-{fmtTime((duration || 0) - pos)}</AppText>
            </View>

            <View style={styles.controls}>
              <Pressable hitSlop={8}><Icon name="shuffle" size={24} color={theme.textSecondary} /></Pressable>
              <Pressable onPress={seekBackward} hitSlop={8} accessibilityLabel="Back 10 seconds"><Icon name="prev" size={30} /></Pressable>
              <Pressable onPress={playPause} style={[styles.bigPlay, { backgroundColor: theme.text }]} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
                <Icon name={isPlaying ? 'pause' : 'play'} size={32} color={theme.background} />
              </Pressable>
              <Pressable onPress={seekForward} hitSlop={8} accessibilityLabel="Forward 10 seconds"><Icon name="next" size={30} /></Pressable>
              <Pressable hitSlop={8}><Icon name="repeat" size={24} color={theme.textSecondary} /></Pressable>
            </View>

            <View style={styles.foot}>
              <Pressable style={styles.pill} hitSlop={6}><Icon name="queue" size={18} color={theme.textSecondary} /><AppText variant="label" color="textSecondary" style={{ fontSize: 12 }}>Up next</AppText></Pressable>
              <Pressable style={styles.pill} hitSlop={6}><Icon name="timer" size={18} color={theme.textSecondary} /><AppText variant="label" color="textSecondary" style={{ fontSize: 12 }}>Sleep timer</AppText></Pressable>
              <Pressable onPress={cycleSpeed} style={styles.pill} hitSlop={6}><Icon name="speed" size={18} color={theme.textSecondary} /><AppText variant="label" color="textSecondary" style={{ fontSize: 12 }}>{speed}×</AppText></Pressable>
            </View>

            {pageText ? (
              <View style={[styles.textCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <AppText variant="bodyL" style={{ lineHeight: 26 }}>{pageText}</AppText>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  mini: {
    position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  miniCover: { width: 42, height: 42 },
  miniBar: { position: 'absolute', left: 13, right: 13, bottom: 5, height: 2, borderRadius: 2 },
  full: { flex: 1 },
  fpHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 6 },
  art: { width: '100%', aspectRatio: 1, marginVertical: 16, maxHeight: 300, alignSelf: 'center' },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 14 },
  bigPlay: {
    width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6,
  },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textCard: { marginTop: 22, padding: 18, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
});

export default FloatingAudioPlayer;
