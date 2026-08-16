// Story Detail — warm design: cover, meta, play/resume, favorite, transcript.
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../context/AudioContext';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Cover } from '../components/story/Cover';
import { fmtMin } from '../components/story/StoryCard';
import apiService from '../services/api';

export const StoryDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { storyId, story: initialStory } = route.params || {};
  const { theme } = useTheme();
  const { playStory, playPause, isPlaying, currentStory } = useAudioPlayer();
  const { toggleFavorite, isInFavorites, user } = useAppContext();
  const [story, setStory] = useState(initialStory || null);
  const [loading, setLoading] = useState(!initialStory);
  const [rating, setRating] = useState(initialStory?.rating || 0);

  useEffect(() => {
    (async () => {
      try {
        const full = await apiService.getStory(storyId);
        if (full) { setStory(full); if (full.rating) setRating(Math.round(full.rating)); }
      } catch (e) { console.warn('detail load', e?.message); }
      finally { setLoading(false); }
    })();
  }, [storyId]);

  const isHere = story && currentStory?.id === story.id;
  const isFavorite = story ? isInFavorites?.(story.id) : false;

  const handlePlay = async () => {
    if (!story) return;
    if (!isHere) await playStory(story); else await playPause();
  };
  const handleFavorite = async () => {
    if (!user) return Alert.alert('Sign in required', 'Please sign in to save favorites.');
    try { await toggleFavorite(story); } catch (e) { Alert.alert('Error', 'Could not update favorite'); }
  };
  const handleRate = async (n) => {
    setRating(n);
    try { await apiService.rateStory(story.id, n); } catch (e) { /* best effort */ }
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} /></View>;
  }
  if (!story) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}><AppText color="textSecondary">Story not found</AppText></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.head, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Icon name="chev-left" /></Pressable>
        <Pressable hitSlop={10} onPress={() => Alert.alert('Share', 'Sharing coming soon.')}><Icon name="share" /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        <Cover story={story} style={styles.cover} radius={22} />
        <AppText variant="h1" style={{ marginTop: 4 }}>{story.title}</AppText>

        <View style={styles.metaRow}>
          {story.genre ? <Tag theme={theme} label={story.genre} /> : null}
          {story.language ? <Tag theme={theme} label={String(story.language).toUpperCase()} /> : null}
          <View style={styles.rate}>
            <Icon name="star" size={14} color={theme.ratingActive} />
            <AppText variant="caption" color="textSecondary">{(story.rating || 0).toFixed(1)}</AppText>
          </View>
          {story.duration ? <AppText variant="caption" color="textSecondary">· {fmtMin(story.duration)}</AppText> : null}
        </View>

        <AppText variant="bodyL" color="textSecondary" style={{ marginTop: 12, lineHeight: 25 }}>{story.description}</AppText>

        <View style={styles.actions}>
          <Button
            title={isHere && isPlaying ? 'Pause' : 'Play'}
            leftIcon={isHere && isPlaying ? 'pause' : 'play'}
            onPress={handlePlay}
            style={{ flex: 1 }}
          />
          <Pressable onPress={handleFavorite} style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Icon name={isFavorite ? 'heart-fill' : 'heart'} color={theme.heart || theme.error} />
          </Pressable>
          <Pressable onPress={() => Alert.alert('Download', 'Offline downloads coming soon.')} style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Icon name="download" />
          </Pressable>
        </View>

        <View style={styles.section}>
          <AppText variant="micro" color="textTertiary" style={{ letterSpacing: 1.2 }}>RATE THIS STORY</AppText>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => handleRate(n)} hitSlop={4}>
                <Icon name={n <= rating ? 'star' : 'star-outline'} size={30} color={n <= rating ? theme.ratingActive : theme.ratingInactive} />
              </Pressable>
            ))}
          </View>
        </View>

        {(story.text || story.description) ? (
          <View style={styles.section}>
            <AppText variant="micro" color="textTertiary" style={{ letterSpacing: 1.2, marginBottom: 8 }}>TRANSCRIPT</AppText>
            <AppText variant="bodyL" color="textSecondary" style={{ lineHeight: 27 }}>{story.text || story.description}</AppText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

function Tag({ theme, label }) {
  return (
    <View style={{ backgroundColor: theme.accentSoft, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 }}>
      <AppText variant="caption" color="accent" style={{ fontWeight: '600' }}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  cover: { width: '100%', height: 220, marginBottom: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  iconBtn: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 26 },
  stars: { flexDirection: 'row', gap: 6, marginTop: 10 },
});

export default StoryDetailScreen;
