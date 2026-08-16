// Story Detail — warm design: cover, meta, play/resume, favorite, transcript.
import React, { useState, useEffect, useRef } from 'react';
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
import { fmtMin, fmtPlays } from '../components/story/StoryCard';
import apiService from '../services/api';

// ---------------------------------------------------------------------------
// Chapter parser
// ---------------------------------------------------------------------------

/**
 * Try to extract chapters from raw story text.
 * Supports explicit headings like "Chapter 1", "CHAPTER II:", "Section 3"
 * Falls back to splitting on double blank lines (\n\n+) into paragraph groups.
 * If no paragraph breaks, splits by sentences as last resort.
 * Returns null when no meaningful structure is found (show full text).
 */
function parseChapters(text) {
  if (!text) return null;

  // 1. Check for explicit chapter headings
  const headingRegex = /^(#{1,3}\s*|#\s*chapter\s*\d+|chapter\s*\d+|chapter\s*[ivxlcdm]+|section\s*\d+|part\s*\d+)[\s:.]*.*$/im;
  const lines = text.split(/\n+/);
  const chapterLines = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (headingRegex.test(trimmed)) {
      chapterLines.push(i);
    }
  }

  if (chapterLines.length >= 2) {
    // Build chapters from heading positions
    const chapters = chapterLines.map((pos, idx) => {
      const end = chapterLines[idx + 1] ?? lines.length;
      const block = lines.slice(pos, end).join('\n').trim();
      // First line is the title; rest is body
      const firstNewline = block.indexOf('\n');
      const title = firstNewline > 0 ? block.slice(0, firstNewline).trim() : block;
      const body = firstNewline > 0 ? block.slice(firstNewline + 1).trim() : '';
      return { title, body };
    });
    // Require at least one chapter to have substantial body content
    if (chapters.some(c => c.body.length > 30)) return chapters;
  }

  // 2. Fallback: split on paragraph breaks (\n\n)
  const paragraphBlocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 15);

  if (paragraphBlocks.length >= 2) {
    return paragraphBlocks.map((body, i) => ({
      title: i === 0 ? 'Part 1' : `Part ${i + 1}`,
      body,
    }));
  }

  // 3. Last resort: split by sentences if text is long enough
  // Match sentences ending with . ! ? or Devanagari danda (।) followed by space or end
  const sentenceMatches = text.match(/[^.!?\u0964]+[.!\u0964]+(?:\s|$)/g);
  if (sentenceMatches && sentenceMatches.length >= 2) {
    // Group sentences into chunks
    const chunkSize = Math.max(2, Math.floor(sentenceMatches.length / 2));
    const chunks = [];
    for (let i = 0; i < sentenceMatches.length; i += chunkSize) {
      chunks.push(sentenceMatches.slice(i, i + chunkSize).join('').trim());
    }
    if (chunks.length >= 2) {
      return chunks.map((body, i) => ({
        title: i === 0 ? 'Part 1' : `Part ${i + 1}`,
        body,
      }));
    }
  }

  return null;
}

export const StoryDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { storyId, story: initialStory } = route.params || {};
  const { theme } = useTheme() || { theme: {} };
  const { playStory, playPause, isPlaying, currentStory } = useAudioPlayer();
  const { toggleFavorite, isInFavorites, user } = useAppContext();
  const [story, setStory] = useState(initialStory || null);
  const [loading, setLoading] = useState(!initialStory);
  const [rating, setRating] = useState(initialStory?.rating || 0);

  // Chapter state
  const [chapters, setChapters] = useState(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterScrollViewRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const full = await apiService.getStory(storyId);
        if (full) {
          setStory(full);
          if (full.rating) setRating(Math.round(full.rating));
        }
      } catch (e) { console.warn('detail load', e?.message); }
      finally { setLoading(false); }
    })();
  }, [storyId]);

  // Parse chapters when story text is available
  useEffect(() => {
    const raw = story?.text || story?.description;
    if (raw) {
      const parsed = story?.chapters && Array.isArray(story.chapters) && story.chapters.length > 0
        ? story.chapters
        : parseChapters(raw);
      setChapters(parsed);
      setActiveChapter(0);
    } else {
      setChapters(null);
    }
  }, [story]);

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

  // Determine which text to show
  const activeBody = chapters
    ? (chapters[activeChapter]?.body || '')
    : null;
  const showFullText = !chapters && (story.text || story.description);

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
          <AppText variant="caption" color="textSecondary">· ▶ {fmtPlays(story.plays)} plays</AppText>
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

        {/* ---- Transcript with chapters ---- */}
        {(story.text || story.description) && (
          <View style={styles.section}>
            <AppText variant="micro" color="textTertiary" style={{ letterSpacing: 1.2, marginBottom: 12 }}>TRANSCRIPT</AppText>

            {chapters && chapters.length > 1 ? (
              <>
                {/* Chapter selector — horizontal scrollable tabs */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chapterTabs}
                  ref={chapterScrollViewRef}
                >
                  {chapters.map((ch, i) => (
                    <Pressable
                      key={i}
                      onPress={() => setActiveChapter(i)}
                      style={[
                        styles.chapterTab,
                        i === activeChapter && { backgroundColor: theme.accent },
                      ]}
                    >
                      <AppText
                        variant="label"
                        color={i === activeChapter ? 'onAccent' : 'textSecondary'}
                        numberOfLines={1}
                      >
                        {ch.title}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Active chapter body */}
                <View style={[styles.chapterBody, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <AppText variant="bodyL" color="textSecondary" style={{ lineHeight: 27 }}>
                    {activeBody || '(no content)'}
                  </AppText>
                </View>
              </>
            ) : showFullText ? (
              // No chapters detected — show full text as before
              <View style={[styles.chapterBody, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <AppText variant="bodyL" color="textSecondary" style={{ lineHeight: 27 }}>
                  {story.text || story.description}
                </AppText>
              </View>
            ) : null}
          </View>
        )}
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

  // Chapter tabs
  chapterTabs: { paddingHorizontal: 0, gap: 8, paddingBottom: 4 },
  chapterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 80,
    alignItems: 'center',
  },
  // Chapter content card
  chapterBody: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginTop: 12,
    minHeight: 80,
  },
});

export default StoryDetailScreen;
