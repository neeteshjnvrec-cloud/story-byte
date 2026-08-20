// Community Screen — Instagram-profile-style single-column feed
// Layout per card:
//   [ COVER IMAGE ]
//   👤 avatar (top-left corner of image)
//   ───────────────────
//   @username   ★ · 5 min ago
//   story title + short description
//   ───────────────────
//   ❤️   💬   ⭐   🔖   📤    ← action bar
//   likes  comments  rating  saved  share

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
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer } from '../context/AudioContext';
import apiService from '../services/api';

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
  const { user, communityStories, fetchCommunityStories, toggleFavorite, isInFavorites } = useAppContext();
  const { playStory } = useAudioPlayer();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [likedStories, setLikedStories] = useState({});
  const [savedStories, setSavedStories] = useState({});
  const [storyRatings, setStoryRatings] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetchCommunityStories().then(() => {
      if (!cancelled) setLoading(false);
    }).catch((e) => {
      if (!cancelled) { setError(e.message || 'Failed to load stories'); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [fetchCommunityStories]);

  // Seed initial like/save state
  useEffect(() => {
    const likes = {};
    const saves = {};
    communityStories.forEach(s => {
      const id = s.id || s.storyId;
      likes[id] = false;
      saves[id] = isInFavorites?.(id) || false;
    });
    setLikedStories(likes);
    setSavedStories(saves);
  }, [communityStories, isInFavorites]);

  const handleStoryPress = (story) => {
    navigation.navigate('StoryDetail', { storyId: story.storyId || story.id, story });
  };

  const handleLike = (story) => {
    const id = story.id || story.storyId;
    setLikedStories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleComment = (story) => {
    Alert.alert('Comments', `Comments coming soon for "${story.title}"`);
  };

  const handleRate = (story) => {
    Alert.alert(
      'Rate this story',
      `How would you rate "${story.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '😞 1', onPress: () => submitRating(story, 1) },
        { text: '😐 2', onPress: () => submitRating(story, 2) },
        { text: '🙂 3', onPress: () => submitRating(story, 3) },
        { text: '😊 4', onPress: () => submitRating(story, 4) },
        { text: '🤩 5', onPress: () => submitRating(story, 5) },
      ]
    );
  };

  const submitRating = async (story, rating) => {
    try {
      await apiService.rateStory(story.id || story.storyId, rating);
      const id = story.id || story.storyId;
      setStoryRatings(prev => ({ ...prev, [id]: rating }));
    } catch (e) {
      Alert.alert('Error', 'Could not save rating');
    }
  };

  const handleShare = (story) => {
    Alert.alert('Share', `Share "${story.title}" — coming soon!`);
  };

  const handleSave = async (story) => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to save favorites.');
      return;
    }
    const id = story.id || story.storyId;
    const isFav = savedStories[id];
    try {
      await toggleFavorite(story);
      setSavedStories(prev => ({ ...prev, [id]: !isFav }));
    } catch (e) {
      Alert.alert('Error', 'Could not update saved stories');
    }
  };

  const handlePlay = async (story) => {
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

  // Show only published stories; pending ones get a special placeholder row
  const published = communityStories.filter(s => s.status === 'published');
  const pending = communityStories.filter(s => s.status === 'under_review' || s._pendingPublish);

  const renderItem = ({ item }) => {
    const id = item.id || item.storyId;
    const isLiked = likedStories[id] || false;
    const isSaved = savedStories[id] || false;
    const rating = storyRatings[id] || 0;
    const plays = item.plays || item.playsCount || 0;
    const postedAt = timeAgo(item.createdAt);
    const authorInitial = (item.authorName || '?')[0].toUpperCase();

    return (
      <View style={styles.post}>
        {/* ═══════════ COVER IMAGE — Hero-style layout ═══════════ */}
        <View style={styles.coverWrap}>
          <TouchableOpacity onPress={() => handleStoryPress(item)} activeOpacity={0.92}>
            {/* Cover image */}
            <Cover story={item} style={styles.cover} radius={16} />

            {/* Gradient fade at bottom for text readability */}
            <LinearGradient
              colors={['transparent 40%', 'rgba(0,0,0,0.75)']}
              style={styles.gradient}
            />

            {/* Profile avatar + username — top-left */}
            <View style={styles.overlayProfile}>
              <View style={[styles.overlayAvatar, { backgroundColor: theme.accent }]}>
                <Text style={styles.overlayAvatarLetter}>{authorInitial}</Text>
              </View>
              <View style={styles.overlayTextWrap}>
                <AppText variant="bodySemi" color="onAccent" numberOfLines={1} style={styles.overlayUsername}>
                  {item.authorName || 'Anonymous'}
                </AppText>
                <AppText variant="caption" color="rgba(255,255,255,0.7)" style={styles.overlayTime}>
                  Published {postedAt}
                </AppText>
              </View>
            </View>

            {/* 3-dot menu — top-right, opens story detail */}
            <TouchableOpacity
              hitSlop={10}
              style={styles.moreBtnTopRight}
              onPress={() => handleStoryPress(item)}
            >
              <Icon name="more" size={22} color="#fff" />
            </TouchableOpacity>

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
                  {item.plays ? `  ·  ▶ ${fmtPlays(item.plays || 0)}` : ''}
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
        </View>

        {/* ═══════════ ACTION BAR ═══════════ */}
        <View style={styles.actionBar}>
          {/* ❤️ Like */}
          <TouchableOpacity onPress={() => handleLike(item)} hitSlop={8} style={styles.actionBtn}>
            <Icon name={isLiked ? 'heart-fill' : 'heart'} size={22} color={isLiked ? '#E53E3E' : theme.text} />
          </TouchableOpacity>

          {/* 💬 Comment */}
          <TouchableOpacity onPress={() => handleComment(item)} hitSlop={8} style={styles.actionBtn}>
            <Icon name="more" size={22} color={theme.text} />
            <Text style={[styles.actionNum, { color: theme.textSecondary }]}>{item.commentsCount || 0}</Text>
          </TouchableOpacity>

          {/* ⭐ Rate */}
          <TouchableOpacity onPress={() => handleRate(item)} hitSlop={8} style={styles.actionBtn}>
            <Icon name={rating > 0 ? 'star' : 'star-outline'} size={22} color={rating > 0 ? theme.ratingActive : theme.text} />
            {rating > 0 && <Text style={[styles.actionNum, { color: theme.ratingActive }]}>{rating}</Text>}
          </TouchableOpacity>

          {/* 🔖 Save */}
          <TouchableOpacity onPress={() => handleSave(item)} hitSlop={8} style={styles.actionBtn}>
            <Icon name={isSaved ? 'check-circle' : 'download-outline'} size={22} color={isSaved ? theme.accent : theme.text} />
          </TouchableOpacity>

          {/* 📤 Share */}
          <TouchableOpacity onPress={() => handleShare(item)} hitSlop={8} style={styles.actionBtn}>
            <Icon name="share" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* ═══════════ TITLE + DESCRIPTION ═══════════ */}
        <View style={styles.captionRow}>
          {item.title ? (
            <AppText variant="body" color="text" style={styles.caption} numberOfLines={3}>
              {item.authorName ? (
                <Text><Text style={{ fontWeight: '700' }}>{item.authorName}: </Text>{item.title}</Text>
              ) : (
                item.title
              )}
              {item.description ? <Text style={{ marginTop: 2 }}>{item.description}</Text> : null}
            </AppText>
          ) : item.description ? (
            <AppText variant="body" color="text" style={styles.caption} numberOfLines={3}>
              {item.description}
            </AppText>
          ) : null}
        </View>

        {/* divider */}
        <View style={[styles.divider, { borderBottomColor: theme.divider }]} />
      </View>
    );
  };

  const renderPendingItem = ({ item }) => (
    <View style={[styles.pendingCard, { borderColor: theme.border }]}>
      <View style={[styles.pendingImg, { backgroundColor: theme.surface }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <View style={styles.pendingAvatar}>
          <Text style={styles.pendingAvatarLetter}>?</Text>
        </View>
      </View>
      <View style={styles.pendingMeta}>
        <AppText variant="bodySemi" color="text" numberOfLines={1} style={styles.pendingUser}>@your-story</AppText>
        <AppText variant="caption" color="accent">{item.genre || 'Story'}</AppText>
        <AppText variant="caption" color="textTertiary" style={styles.pendingHint}>
          Generating audio & cover…
        </AppText>
      </View>
    </View>
  );

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
          data={[...pending, ...published]}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) =>
            item._pendingPublish || item.status === 'under_review'
              ? renderPendingItem({ item })
              : renderItem({ item })
          }
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
  post: {},

  coverWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },

  // Profile avatar + username — top-left
  overlayProfile: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overlayAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  overlayAvatarLetter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  overlayUsername: {
    fontWeight: '700',
    fontSize: 14,
  },
  overlayTextWrap: { flex: 1, minWidth: 0 },
  overlayTime: {
    fontSize: 11,
    marginTop: 1,
  },
  // 3-dot menu — top-right
  moreBtnTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero-style meta — bottom-left of card (like Home hero)
  heroMeta: {
    position: 'absolute',
    bottom: 60,
    left: 14,
    right: 70,
  },
  heroTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.92)',
  },
  heroFab: {
    position: 'absolute',
    right: 14,
    bottom: 14,
  },
  playBtnCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },

  // Caption
  captionRow: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  caption: {
    lineHeight: 20,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  actionNum: {
    fontSize: 12,
    fontWeight: '600',
  },

  divider: {
    borderBottomWidth: 1,
    marginHorizontal: 14,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },

  // Pending card
  pendingCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  pendingImg: {
    width: '100%',
    aspectRatio: 4 / 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pendingAvatar: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAvatarLetter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  pendingMeta: {
    padding: 12,
  },
  pendingUser: { fontWeight: '700' },
  pendingHint: { marginTop: 4, fontStyle: 'italic' },
});
