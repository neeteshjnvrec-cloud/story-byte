// Story card variants + PlayFab, composed from Cover + AppText + Icon.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { Cover } from './Cover';
import { fmtMin, fmtPlays, storyPlays } from '../../utils/storyMetrics';

// Re-exported: screens have imported these from here since before the helpers
// moved out to utils/storyMetrics, and both are used right here.
export { fmtMin, fmtPlays, storyPlays };

export function PlayFab({ size = 46, solid, onPress, style }) {
  const { theme } = useTheme() || { theme: {} };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Play"
      hitSlop={8}
      style={[
        styles.fab,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: solid ? theme.accent : '#fff' },
        style,
      ]}
    >
      <Icon name="play" size={size * 0.44} color={solid ? theme.onAccent : theme.accent} />
    </Pressable>
  );
}

// Vertical rail card (~138 wide).
export function RailCard({ story, width = 138, onPress, onPlay }) {
  const { theme } = useTheme() || { theme: {} };
  const plays = storyPlays(story);
  return (
    <Pressable onPress={onPress} style={{ width }} accessibilityRole="button" accessibilityLabel={story.title}>
      <Cover story={story} style={{ height: width }} radius={16}>
        {onPlay ? <PlayFab size={34} solid onPress={onPlay} style={styles.railFab} /> : null}
      </Cover>
      <AppText variant="h3" numberOfLines={2} style={{ marginTop: 8 }}>{story.title}</AppText>
      <AppText variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: 2 }}>
        {story.duration ? fmtMin(story.duration) : (story.genre || 'Story')}{plays ? `  ·  ▶ ${fmtPlays(plays)}` : ''}
      </AppText>
    </Pressable>
  );
}

// Horizontal compact row for lists/search/history.
export function CompactRow({ story, onPress, subtitle, trailing }) {
  const { theme } = useTheme() || { theme: {} };
  const plays = storyPlays(story);
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={story.title}>
      <Cover story={story} style={styles.rowCover} radius={12} />
      <View style={{ flex: 1 }}>
        <AppText variant="h3" numberOfLines={1}>{story.title}</AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: 2 }}>
          {subtitle != null ? subtitle : `${story.genre || 'Story'}${story.duration ? ` · ${fmtMin(story.duration)}` : ''}${plays ? ` · ▶ ${fmtPlays(plays)}` : ''}`}
        </AppText>
      </View>
      {trailing}
    </Pressable>
  );
}

// Full-bleed hero.
export function Hero({ story, badge = "Today's pick", onPress, onPlay }) {
  const { theme } = useTheme() || { theme: {} };
  const plays = storyPlays(story);
  return (
    <Pressable onPress={onPress} style={styles.hero} accessibilityRole="button" accessibilityLabel={story.title}>
      <Cover story={story} style={StyleSheet.absoluteFill} radius={24} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.62)']} style={StyleSheet.absoluteFill} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <AppText variant="micro" color="onAccent" style={{ textTransform: 'uppercase' }}>{badge}</AppText>
        </View>
      ) : null}
      {onPlay ? <PlayFab size={46} onPress={onPlay} style={styles.heroFab} /> : null}
      <View style={styles.heroMeta}>
        <AppText variant="h1" color="text" style={{ color: '#fff' }} numberOfLines={2}>{story.title}</AppText>
        <View style={styles.heroSub}>
          <Icon name="note" size={13} color="rgba(255,255,255,0.9)" />
          <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.92)' }}>
            {fmtMin(story.duration) || '—'}{story.genre ? `  ·  ${story.genre}` : ''}{plays ? `  ·  ▶ ${fmtPlays(plays)}` : ''}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  railFab: { position: 'absolute', right: 8, bottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 10, paddingHorizontal: 20 },
  rowCover: { width: 48, height: 48 },
  hero: {
    height: 200, marginHorizontal: 20, borderRadius: 24, overflow: 'hidden', position: 'relative',
    shadowColor: '#3C2814', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 8,
  },
  badge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  heroFab: { position: 'absolute', right: 14, bottom: 14 },
  heroMeta: { position: 'absolute', left: 18, right: 18, bottom: 16 },
  heroSub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
});
