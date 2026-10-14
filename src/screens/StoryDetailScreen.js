// Story Detail — warm design: cover, meta, play/resume, favorite, transcript.
import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../context/AudioContext';
import { useAppContext } from '../context/AppContext';
import { useWallet } from '../context/WalletContext';
import { isPaidStory } from '../services/wallet';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Cover } from '../components/story/Cover';
import { fmtMin, fmtPlays } from '../components/story/StoryCard';
import { CommentSheet } from '../components/comments/CommentSheet';
import { shareStory } from '../utils/shareStory';
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
  const { theme = {} } = useTheme();
  const { playStory, playPause, isPlaying, currentStory } = useAudioPlayer();
  const {
    toggleFavorite, user, getStoryMetrics, toggleLike, recordShare,
    rateStory: rateStoryInContext, receiveStoryDocs, downloads, downloadingIds, toggleDownload,
  } = useAppContext();
  const { canPlay, unlock, balance, premiumAudioUrl } = useWallet();
  const [unlocking, setUnlocking] = useState(false);
  const [story, setStory] = useState(initialStory || null);
  const [loading, setLoading] = useState(!initialStory);
  const [commentVisible, setCommentVisible] = useState(false);

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
          // Publish the fresh aggregates to the shared store so the feed picks
          // up anything that changed while it wasn't listening.
          receiveStoryDocs(full);
        }
      } catch (e) { console.warn('detail load', e?.message); }
      finally { setLoading(false); }
    })();
  }, [storyId, receiveStoryDocs]);

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

  // A paid long episode: its audio comes from premium_audio once unlocked,
  // which also lets it be downloaded like any other story.
  const paid = isPaidStory(story);
  const locked = paid && !canPlay(story);
  useEffect(() => {
    if (!paid || locked || story?.audioUrl) return;
    let active = true;
    premiumAudioUrl(story.id).then((url) => {
      if (active && url) setStory((s) => (s && s.id === story.id ? { ...s, audioUrl: url } : s));
    });
    return () => { active = false; };
  }, [paid, locked, story?.id, story?.audioUrl, premiumAudioUrl]);

  const isHere = story && currentStory?.id === story.id;
  // Same numbers as the community feed — one shared store behind both.
  // `rating` is the community average; `myRating` is this user's own score.
  const { liked, likesCount, saved, plays, rating, sharesCount, myRating } = getStoryMetrics(story);

  // Only count a share the OS confirms went out, so backing out of the sheet
  // doesn't inflate the number. (Android always reports success — see
  // recordShare in AppContext.)
  const handleShare = async () => {
    const { shared } = await shareStory(story);
    if (shared) recordShare(story);
  };

  const handleUnlock = () => {
    const price = Number(story.priceCoins) || 0;
    if (balance < price) {
      return Alert.alert(
        'Not enough coins',
        `This episode costs ${price} coins and you have ${balance}. Earn ${price - balance} more with the daily check-in, by finishing stories, or by inviting friends.`,
        [{ text: 'Not now', style: 'cancel' }, { text: 'Earn coins', onPress: () => navigation.navigate('Coins') }],
      );
    }
    Alert.alert('Unlock this episode?', `"${story.title}" for ${price} coins. You'll have ${balance - price} left, and it stays unlocked for good.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Unlock (${price} 🪙)`,
        onPress: async () => {
          setUnlocking(true);
          try {
            await unlock(story);
            const url = await premiumAudioUrl(story.id);
            const opened = url ? { ...story, audioUrl: url } : story;
            setStory(opened);
            if (url) await playStory(opened);
          } catch (e) {
            if (e?.code === 'not-enough-coins') {
              Alert.alert('Not enough coins', `You need ${e.needed} more coins for this episode.`);
            } else {
              Alert.alert('Couldn’t unlock', 'Please check your connection and try again. No coins were taken.');
            }
          } finally { setUnlocking(false); }
        },
      },
    ]);
  };

  const handlePlay = async () => {
    if (!story) return;
    if (locked) return handleUnlock();
    if (!isHere) await playStory(story); else await playPause();
  };
  const handleLike = async () => {
    if (!user) return Alert.alert('Sign in required', 'Please sign in to like stories.');
    try { await toggleLike(story); } catch (e) { Alert.alert('Error', 'Could not update like'); }
  };
  const handleFavorite = async () => {
    if (!user) return Alert.alert('Sign in required', 'Please sign in to save favorites.');
    try { await toggleFavorite(story); } catch (e) { Alert.alert('Error', 'Could not update favorite'); }
  };
  const handleRate = async (n) => {
    if (!user) return Alert.alert('Sign in required', 'Please sign in to rate stories.');
    try { await rateStoryInContext(story, n); } catch (e) { Alert.alert('Error', 'Could not save rating'); }
  };

  const handleDownload = async () => {
    if (locked) return handleUnlock();
    if (!story?.audioUrl) return Alert.alert('No audio', 'This story has no audio available yet.');
    try {
      const result = await toggleDownload(story);
      if (result.downloaded) {
        Alert.alert('Downloaded', `"${story.title}" saved for offline listening.`, [
          { text: 'Play Offline', onPress: () => playStory({ ...story, audioUrl: result.path }) },
          { text: 'OK' },
        ]);
      } else if (result.path) {
        // toggleDownload removes the file when already present; that's a success,
        // not a failure. (The icon already updates via downloads state.)
        Alert.alert('Removed', `"${story.title}" removed from offline listening.`);
      } else {
        Alert.alert('Download failed', 'Could not download this story. Check your connection.');
      }
    } catch (e) {
      Alert.alert('Error', 'Download failed. Please try again.');
    }
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
        {/* Share and comment both carry a count, so both use the same corner
            badge — an inline number would change this row's height. */}
        <Pressable hitSlop={10} onPress={handleShare} style={styles.headBtn}>
          <Icon name="share" />
          {sharesCount > 0 ? (
            <View style={[styles.headBadge, { backgroundColor: theme.accent }]}>
              <AppText variant="micro" color="onAccent" style={{ paddingHorizontal: 4 }}>{fmtPlays(sharesCount)}</AppText>
            </View>
          ) : null}
        </Pressable>
        <Pressable hitSlop={10} onPress={() => setCommentVisible(true)} style={styles.headBtn}>
          <Icon name="chat" />
          {story?.commentsCount > 0 ? (
            <View style={[styles.headBadge, { backgroundColor: theme.accent }]}>
              <AppText variant="micro" color="onAccent" style={{ paddingHorizontal: 4 }}>{story.commentsCount}</AppText>
            </View>
          ) : null}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        <Cover story={story} style={styles.cover} radius={22} />
        <AppText variant="h1" style={{ marginTop: 4 }}>{story.title}</AppText>

        {/* Zero-valued metrics are omitted rather than shown as "0" — same rule
            as the feed and the story cards. */}
        <View style={styles.metaRow}>
          {story.genre ? <Tag theme={theme} label={story.genre} /> : null}
          {story.language ? <Tag theme={theme} label={String(story.language).toUpperCase()} /> : null}
          {rating > 0 ? (
            <View style={styles.rate}>
              <Icon name="star" size={14} color={theme.ratingActive} />
              <AppText variant="caption" color="textSecondary">{rating.toFixed(1)}</AppText>
            </View>
          ) : null}
          {story.duration ? <AppText variant="caption" color="textSecondary">· {fmtMin(story.duration)}</AppText> : null}
          {plays > 0 ? <AppText variant="caption" color="textSecondary">· ▶ {fmtPlays(plays)} plays</AppText> : null}
        </View>

        <AppText variant="bodyL" color="textSecondary" style={{ marginTop: 12, lineHeight: 25 }}>{story.description}</AppText>

        <View style={styles.actions}>
          <Button
            title={locked ? `Unlock for ${story.priceCoins} coins` : isHere && isPlaying ? 'Pause' : 'Play'}
            leftIcon={locked ? 'lock' : isHere && isPlaying ? 'pause' : 'play'}
            onPress={handlePlay}
            loading={unlocking}
            style={{ flex: 1 }}
          />
          {/* Heart = like, bookmark = save — matching the community feed. The
              heart used to toggle favorites here, so a like made on the feed
              looked like it had been lost when you opened the story. */}
          <Pressable onPress={handleLike} style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Icon name={liked ? 'heart-fill' : 'heart'} color={liked ? theme.error : theme.text} />
            {likesCount > 0 ? (
              <AppText variant="micro" color="textSecondary" style={styles.iconBtnCount}>{fmtPlays(likesCount)}</AppText>
            ) : null}
          </Pressable>
          <Pressable onPress={handleFavorite} style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Icon name={saved ? 'bookmark-fill' : 'bookmark'} color={saved ? theme.accent : theme.text} />
          </Pressable>
          <Pressable onPress={handleDownload} style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Icon name={downloads[story?.id]?.path ? 'check-circle' : 'download'} />
            {downloadingIds.has(story?.id) && <ActivityIndicator size={14} color={theme.accent} style={{ position: 'absolute' }} />}
          </Pressable>
        </View>

        <View style={styles.section}>
          <AppText variant="micro" color="textTertiary" style={{ letterSpacing: 1.2 }}>
            {myRating > 0 ? 'YOUR RATING' : 'RATE THIS STORY'}
          </AppText>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => handleRate(n)} hitSlop={4}>
                {/* Your own score. This used to be seeded from the community
                    average, so a story averaging 4.2 showed four filled stars
                    as though you had rated it. */}
                <Icon name={n <= myRating ? 'star' : 'star-outline'} size={30} color={n <= myRating ? theme.ratingActive : theme.ratingInactive} />
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
      {story && (
        <CommentSheet
          story={story}
          visible={commentVisible}
          onClose={() => setCommentVisible(false)}
        />
      )}
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
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  // Shared by the header's share and comment buttons; the badge is positioned
  // against the padded box, so both need `position: relative`.
  headBtn: { position: 'relative', padding: 4 },
  headBadge: {
    position: 'absolute', top: -2, right: -4, borderRadius: 10,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  cover: { width: '100%', height: 220, marginBottom: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  iconBtn: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Stacked under the icon inside the same 52pt square. Only rendered at ≥1
  // like, so the icon sits dead-centre until there's a number to show.
  iconBtnCount: { marginTop: 1 },
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
