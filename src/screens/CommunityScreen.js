// Community Screen — Instagram-style single-column feed
// Layout per card:
//   👤 avatar   author name          ⋯     ← header, on the app background
//               17h ago
//   ───────────────────
//   [ COVER IMAGE — title/duration + play FAB over a bottom-only scrim ]
//   ───────────────────
//   ❤️   💬   ⭐   🔖   📤    ← action bar
//   likes  comments  rating  saved  share
//   ───────────────────
//   **author** description         ← caption
//
// The header is intentionally NOT overlaid on the cover. A chip or top scrim
// sitting on artwork reads as a dark patch with a hard edge no matter how it's
// sized or tinted; moving it onto the background removes the problem outright.

import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAppContext } from '../context/AppContext';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { HeaderNotificationButton } from '../components/HeaderNotificationButton';
import { Cover } from '../components/story/Cover';
import { fmtMin, fmtPlays } from '../components/story/StoryCard';
import { CommentSheet } from '../components/comments/CommentSheet';
import { authorOf, myAuthorName } from '../utils/author';
import { shareStory } from '../utils/shareStory';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer } from '../context/AudioContext';
import { Image } from 'expo-image';
import { collection, query, where, onSnapshot, orderBy, limit as fbLimit } from 'firebase/firestore';
import { isVideoStory } from '../utils/videoStory';
import { db } from '../services/firebase';

// Relative time formatter
function timeAgo(dateValue) {
  if (!dateValue) return '';
  const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CommunityScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const {
    user, communityStories, fetchCommunityStories, receiveCommunityStories, loadMoreCommunity, communityHasMore,
    toggleFavorite, getStoryMetrics, toggleLike, rateStory, recordShare, setLastPlayTab, userStats,
  } = useAppContext();
  const me = { uid: user?.uid, name: myAuthorName(user, userStats) };
  const { playStory, setNextStory } = useAudioPlayer();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratingOpenFor, setRatingOpenFor] = useState(null);
  const [commentStory, setCommentStory] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Initial fetch
    fetchCommunityStories().then(() => {
      if (!cancelled) setLoading(false);
    }).catch((e) => {
      if (!cancelled) { setError(e.message || 'Failed to load stories'); setLoading(false); }
    });

    // Real-time listener on the newest page — daily, community and video
    // stories. Older pages load as the list nears its end (loadMoreCommunity).
    const q = query(
      collection(db, 'stories'),
      where('status', 'in', ['published', 'video']),
      orderBy('createdAt', 'desc'),
      fbLimit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (cancelled) return;
      const stories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Hand the docs to the context, which updates both the story list and the
      // shared metric store — so a like made here is visible on Story Detail
      // and anywhere else showing the same story.
      receiveCommunityStories(stories);
      setError(null);
      setLoading(false);
    }, (error) => {
      console.error('[CommunityScreen] Realtime listener error:', error);
      if (!cancelled) { setError(error.message || 'Failed to load stories'); setLoading(false); }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchCommunityStories, receiveCommunityStories]);

  const handleStoryPress = (story) => {
    navigation.navigate('StoryDetail', { storyId: story.storyId || story.id, story });
  };

  // The optimistic-update-and-revert logic for all three of these lives in
  // AppContext now, so the same tap behaves identically on Story Detail.
  const handleLike = async (story) => {
    try {
      const result = await toggleLike(story);
      if (result?.needsAuth) Alert.alert('Sign in required', 'Please sign in to like stories.');
    } catch (e) {
      Alert.alert('Error', 'Could not update like');
    }
  };

  const handleComment = (story) => {
    setCommentStory(story);
  };

  // Tapping the star swaps the left action cluster for an inline 1–5 row.
  // (Alert.alert can't do this: Android caps it at 3 buttons, so the old
  // six-button rating alert silently dropped most of its options there.)
  const handleRate = (story) => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to rate stories.');
      return;
    }
    const id = story.id || story.storyId;
    setRatingOpenFor(prev => (prev === id ? null : id));
  };

  const submitRating = async (story, rating) => {
    setRatingOpenFor(null);
    try {
      const result = await rateStory(story, rating);
      if (result?.needsAuth) Alert.alert('Sign in required', 'Please sign in to rate stories.');
    } catch (e) {
      Alert.alert('Error', 'Could not save rating');
    }
  };

  // Only count a share the OS says actually went out, so dismissing the sheet
  // doesn't inflate the number. (On Android it always reports success — see
  // recordShare in AppContext.)
  const handleShare = async (story) => {
    const { shared } = await shareStory(story);
    if (shared) recordShare(story);
  };

  const handleSave = async (story) => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to save favorites.');
      return;
    }
    try {
      await toggleFavorite(story);
    } catch (e) {
      Alert.alert('Error', 'Could not update saved stories');
    }
  };

  const handlePlay = async (story) => {
    // A video story starts in the floating video player.
    if (isVideoStory(story)) return playStory(story);
    setLastPlayTab('community');
    // Provide the autoplay next-story callback: find this story's index in the
    // feed and return the next one (wrapping is fine — unlikely in a 50-item
    // feed, but harmless).
    setNextStory(() => {
      const idx = communityStories.findIndex(
        (s) => (s.id || s.storyId) === (story.id || story.storyId)
      );
      if (idx < 0 || idx >= communityStories.length - 1) return null;
      return communityStories[idx + 1];
    });
    await playStory(story);
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetchCommunityStories().catch((e) => {
      setError(e.message || 'Failed to load stories');
      setLoading(false);
    });
  };

  const keyExtractor = (item, index) => item.storyId || item.id || `story-key-${index}`;

  // The query already filters to published, so nothing here needs a status
  // branch — an under_review story never reaches this screen at all.
  const published = communityStories;

  const renderItem = ({ item }) => {
    const id = item.id || item.storyId;
    // Every metric from one place, so these numbers match Story Detail exactly.
    const { liked, likesCount, saved, plays, rating, sharesCount, myRating } = getStoryMetrics(item);
    const isRatingOpen = ratingOpenFor === id;
    const postedAt = timeAgo(item.createdAt);
    const authorName = authorOf(item, me);
    const authorInitial = authorName[0].toUpperCase();

    return (
      <View style={styles.post}>
        {/* ═══════════ AUTHOR HEADER — above the media, on the app background.
            Deliberately NOT overlaid on the cover: a scrim or chip sitting on
            artwork always reads as a patch. ═══════════ */}
        <View style={styles.postHeader}>
          <View style={[styles.headerAvatar, { backgroundColor: theme.accent }]}>
            {item.authorProfilePic ? (
              <Image
                source={{ uri: item.authorProfilePic }}
                style={styles.headerAvatarImage}
                contentFit="cover"
                transition={100}
              />
            ) : (
              <Text style={styles.headerAvatarLetter}>{authorInitial}</Text>
            )}
          </View>
          <View style={styles.headerTextWrap}>
            <AppText variant="bodySemi" color="text" numberOfLines={1}>
              {authorName}
            </AppText>
            {postedAt ? (
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {postedAt}
              </AppText>
            ) : null}
          </View>
          <TouchableOpacity
            hitSlop={10}
            style={styles.headerMoreBtn}
            onPress={() => handleStoryPress(item)}
            accessibilityLabel="Story options"
          >
            <Icon name="more" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* ═══════════ COVER IMAGE ═══════════ */}
        <TouchableOpacity onPress={() => handleStoryPress(item)} activeOpacity={0.92} style={styles.coverWrap}>
          {/* Cover image */}
          <Cover story={item} style={StyleSheet.absoluteFill} radius={24} />

            {/* Bottom-only scrim for the title + meta. `colors` takes colors
                only — stop positions go in `locations`. */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.75)']}
              locations={[0.45, 1]}
              pointerEvents="none"
              style={styles.gradient}
            />

            {/* Title + meta — bottom-left (like Hero card) */}
            <View style={styles.heroMeta}>
              <AppText variant="h1" color="text" style={styles.heroTitle} numberOfLines={2}>
                {item.title || 'Untitled Story'}
              </AppText>
              <View style={styles.heroSub}>
                <Icon name="note" size={13} color="rgba(255,255,255,0.9)" />
                <AppText variant="caption" style={styles.heroMetaText}>
                  {fmtMin(item.duration || 0)}
                  {item.genre ? `  ·  ${item.genre}` : ''}
                  {plays ? `  ·  ▶ ${fmtPlays(plays)}` : ''}
                </AppText>
              </View>
            </View>

            {/* Play button — bottom-right (like Hero card) */}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handlePlay(item); }}
              hitSlop={16}
              style={styles.heroFab}
              accessibilityLabel="Play story"
            >
              <View style={[styles.playBtnCircle, { backgroundColor: theme.accent }]}>
                <Icon name="play" size={28} color="#fff" />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>

        {/* ═══════════ ACTION BAR ═══════════ */}
        {/* Like / comment / rate / send cluster on the left; save is pushed to
            the far right on its own, as in Instagram. Tapping rate swaps the
            left cluster for an inline 1–5 star row. */}
        <View style={styles.actionBar}>
          {isRatingOpen ? (
            <>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => submitRating(item, n)}
                  hitSlop={6}
                  style={[styles.starBtn, n === 1 && styles.starBtnFirst]}
                  accessibilityLabel={`Rate ${n} out of 5`}
                >
                  {/* Pre-filled with your own score, not the community average. */}
                  <Icon
                    name={n <= myRating ? 'star' : 'star-outline'}
                    size={24}
                    color={n <= myRating ? theme.ratingActive : theme.ratingInactive}
                  />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setRatingOpenFor(null)}
                hitSlop={8}
                style={styles.actionBtn}
                accessibilityLabel="Cancel rating"
              >
                <Icon name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* ❤️ Like — the heart means "like" here and on Story Detail;
                  saving is the bookmark at the far right. */}
              <TouchableOpacity onPress={() => handleLike(item)} hitSlop={8} style={styles.actionBtn}>
                <Icon name={liked ? 'heart-fill' : 'heart'} size={22} color={liked ? theme.error : theme.text} />
                {likesCount > 0 ? (
                  <Text style={[styles.actionNum, { color: liked ? '#E53E3E' : theme.textSecondary }]}>
                    {likesCount}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* 💬 Comment */}
              <TouchableOpacity onPress={() => handleComment(item)} hitSlop={8} style={styles.actionBtn}>
                <Icon name="chat" size={22} color={theme.text} />
                {item.commentsCount > 0 ? (
                  <Text style={[styles.actionNum, { color: theme.textSecondary }]}>{item.commentsCount}</Text>
                ) : null}
              </TouchableOpacity>

              {/* ⭐ Rate — StoryByte-specific, sits where Instagram puts repost.
                  The number is the community average; the fill says whether YOU
                  rated it. Both meanings, one control. */}
              <TouchableOpacity onPress={() => handleRate(item)} hitSlop={8} style={styles.actionBtn}>
                <Icon
                  name={myRating > 0 ? 'star' : 'star-outline'}
                  size={22}
                  color={myRating > 0 ? theme.ratingActive : theme.text}
                />
                {rating > 0 ? (
                  <Text style={[styles.actionNum, { color: myRating > 0 ? theme.ratingActive : theme.textSecondary }]}>
                    {rating.toFixed(1)}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* ↗ Share — platform-native glyph; see Icon.js */}
              <TouchableOpacity onPress={() => handleShare(item)} hitSlop={8} style={styles.actionBtn}>
                <Icon name="share" size={22} color={theme.text} />
                {sharesCount > 0 ? (
                  <Text style={[styles.actionNum, { color: theme.textSecondary }]}>{sharesCount}</Text>
                ) : null}
              </TouchableOpacity>
            </>
          )}

          {/* 🔖 Save — right-aligned */}
          <TouchableOpacity onPress={() => handleSave(item)} hitSlop={8} style={[styles.actionBtn, styles.actionBtnEnd]}>
            <Icon name={saved ? 'bookmark-fill' : 'bookmark'} size={22} color={saved ? theme.accent : theme.text} />
          </TouchableOpacity>
        </View>

        {/* ═══════════ CAPTION — story description only; the header already
            identifies the publisher, so repeating the name here is redundant. */}
        {item.description || item.title ? (
          <View style={styles.captionRow}>
            <AppText variant="body" color="text" style={styles.caption} numberOfLines={3}>
              {item.description || item.title}
            </AppText>
          </View>
        ) : null}

        {/* divider */}
        <View style={[styles.divider, { borderBottomColor: theme.divider }]} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <AppText variant="displayM">
          <AppText variant="displayM" color="accent">Story</AppText>Byte
        </AppText>
        <View style={styles.headerIcons}>
          <HeaderNotificationButton size={22} color={theme.text} />
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
            <Icon name="gear" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      {error ? (
        <View style={styles.center}>
          <Icon name="alert-circle" size={40} color={theme.error} />
          <AppText variant="body" color="textSecondary" style={styles.errorText}>{error}</AppText>
          <TouchableOpacity onPress={handleRetry} style={[styles.retryBtn, { backgroundColor: theme.accent }]}>
            <AppText variant="label" color="onAccent">Retry</AppText>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={published}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // Metrics live outside `data` now, so FlatList needs telling when they
          // move. getStoryMetrics' identity changes exactly when the shared
          // like/rating/play state does, which is precisely when rows must repaint.
          extraData={getStoryMetrics}
          renderItem={renderItem}
          // The next 5 as the end comes into view.
          onEndReached={() => { if (communityHasMore) loadMoreCommunity(); }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={communityHasMore && published.length ? (
            <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
          ) : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="people" size={48} color={theme.textTertiary} />
              <AppText variant="h3" color="text" style={{ marginTop: 16 }}>No stories yet</AppText>
              <AppText variant="body" color="textSecondary" style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
                Be the first to create a story for the community!
              </AppText>
            </View>
          }
        />
      )}
      {commentStory ? (
        <CommentSheet
          story={commentStory}
          visible={!!commentStory}
          onClose={() => setCommentStory(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listContent: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { textAlign: 'center', marginTop: 12, paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25, marginTop: 16 },

  // ── Post Card ──
  // Community card — identical to Home Hero card
  post: {},

  coverWrap: {
    height: 200,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#3C2814',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 12,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Author header (above the media, on the app background) ──
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarLetter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  headerAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  // flex: 1 is correct here (unlike on an absolute node): it pushes the ⋯
  // button to the right edge and lets the name ellipsize.
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerMoreBtn: { padding: 4 },

  // Compact hero meta - bottom-left of card
  heroMeta: {
    position: 'absolute',
    bottom: 48,
    left: 10,
    right: 60,
  },
  heroTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
  },
  heroFab: {
    position: 'absolute',
    right: 10,
    bottom: 10,
  },
  playBtnCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },

  // Caption
  captionRow: {
    // 20 = the card gutter (coverWrap marginHorizontal / postHeader padding).
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  caption: {
    lineHeight: 20,
  },

  // Action bar — 12 here + 8 on actionBtn lands the first icon on the same
  // 20pt gutter as the cover and caption.
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  actionNum: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Pushes save to the far right, leaving the other actions clustered left.
  actionBtnEnd: {
    marginLeft: 'auto',
  },
  // Inline 1–5 stars. Tighter than actionBtn so all five plus the cancel
  // button fit on the same row without crowding the right-aligned save.
  starBtn: {
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  // 12 (actionBar) + 8 = the same 20pt gutter the heart icon sits on, so the
  // row doesn't shift sideways when it expands.
  starBtnFirst: {
    paddingLeft: 8,
  },

  divider: {
    borderBottomWidth: 1,
    marginHorizontal: 20,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
});
