// "Continue listening" card: cover, title, how much is left, a progress bar,
// a resume button and an ✕ to drop the story from the row.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { Cover } from './Cover';

/** "12 min left" / "Less than a minute left". */
export function timeLeft(item) {
  const total = item.duration || 0;
  const pct = Math.min(1, Math.max(0, item.progress || 0));
  const left = Math.max(0, total * (1 - pct));
  if (!total) return `${Math.round(pct * 100)}% listened`;
  const min = Math.round(left / 60);
  return min < 1 ? 'Less than a minute left' : `${min} min left`;
}

export function ContinueCard({ item, width = 260, onResume, onOpen, onRemove }) {
  const { theme } = useTheme() || { theme: {} };
  const pct = Math.min(1, Math.max(0, item.progress || 0));
  return (
    <Pressable
      onPress={onOpen}
      style={[styles.card, { width, backgroundColor: theme.card, borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${timeLeft(item)}`}
    >
      <Cover story={item} style={styles.cover} radius={12} />
      <View style={styles.body}>
        <AppText variant="h3" numberOfLines={2}>{item.title}</AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: 4 }}>
          {timeLeft(item)}
        </AppText>
        <View style={[styles.track, { backgroundColor: theme.divider || theme.border }]}>
          <View style={[styles.fill, { width: `${Math.max(3, pct * 100)}%`, backgroundColor: theme.accent }]} />
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.title} from Continue listening`}
        >
          <Icon name="close" size={16} color={theme.textTertiary || theme.textSecondary} />
        </Pressable>
        <Pressable
          onPress={onResume}
          hitSlop={8}
          style={[styles.play, { backgroundColor: theme.accent }]}
          accessibilityRole="button"
          accessibilityLabel={`Resume ${item.title}`}
        >
          <Icon name="play" size={16} color={theme.onAccent} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10,
    borderRadius: 16, borderWidth: 1,
  },
  cover: { width: 64, height: 64 },
  body: { flex: 1, minWidth: 0 },
  track: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  actions: { alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 2 },
  play: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

export default ContinueCard;
