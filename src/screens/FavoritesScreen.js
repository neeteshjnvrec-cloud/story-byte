// Library Screen for Story Byte — Favorites / Downloads / History.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import apiService from '../services/api';
import { useAudioPlayer } from '../context/AudioContext';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { CompactRow } from '../components/story/StoryCard';

// Saved stories / history entries per page; more load as you scroll.
const PAGE_SIZE = 20;

const SEGMENTS = [
  { key: 'favorites', label: 'Favorites' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'history', label: 'History' },
];

export const FavoritesScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme() || { theme: {} };
  const insets = useSafeAreaInsets();
  const { favorites, loading: contextLoading, downloads, downloadingIds, toggleDownload } = useAppContext();
  const { playStory } = useAudioPlayer();
  const [stories, setStories] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('favorites');
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Saved: how many of the (newest-first) saved ids are loaded. History: the
  // cursor for its next page.
  const favPage = useRef({ loaded: 0, busy: false, request: 0 });
  const histPage = useRef({ cursor: null, hasMore: false, busy: false });
  const [historyHasMore, setHistoryHasMore] = useState(false);

  // The saved list changes when a story is saved or unsaved anywhere: start
  // its pages over. History reloads its first page each time Library opens,
  // so what you just played is there.
  const favoriteIds = favorites.map((f) => f.storyId || f.id);
  const favoriteKey = favoriteIds.join(',');
  useEffect(() => {
    loadFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteKey]);
  useFocusEffect(useCallback(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const loadFavorites = async () => {
    const request = ++favPage.current.request;
    favPage.current.busy = true;
    try {
      setLoading(true);
      setError(null);
      const first = await apiService.getFavoriteStories(favoriteIds.slice(0, PAGE_SIZE));
      if (request !== favPage.current.request) return;
      favPage.current.loaded = Math.min(PAGE_SIZE, favoriteIds.length);
      setStories(first);
    } catch (error) {
      console.error('Error loading favorites:', error);
      setError('Failed to load favorites. Please try again.');
    } finally {
      if (request === favPage.current.request) {
        favPage.current.busy = false;
        setLoading(false);
      }
    }
  };

  const loadHistory = async () => {
    try {
      setError(null);
      const res = await apiService.getUserProgressPage({ pageSize: PAGE_SIZE });
      histPage.current = { cursor: res.cursor, hasMore: res.hasMore, busy: false };
      setHistoryHasMore(res.hasMore);
      setHistory(res.items || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const favoritesHaveMore = favPage.current.loaded < favoriteIds.length;

  // The next page of whichever list is showing.
  const loadMore = async () => {
    if (active === 'favorites') {
      const pageState = favPage.current;
      if (pageState.busy || pageState.loaded >= favoriteIds.length) return;
      const request = pageState.request;
      pageState.busy = true;
      setLoadingMore(true);
      try {
        const next = await apiService.getFavoriteStories(favoriteIds.slice(pageState.loaded, pageState.loaded + PAGE_SIZE));
        if (request !== pageState.request) return;
        pageState.loaded = Math.min(pageState.loaded + PAGE_SIZE, favoriteIds.length);
        setStories((prev) => [...prev, ...next.filter((n) => !prev.some((p) => p.id === n.id))]);
      } finally {
        if (request === pageState.request) pageState.busy = false;
        setLoadingMore(false);
      }
    } else if (active === 'history') {
      const pageState = histPage.current;
      if (pageState.busy || !pageState.hasMore) return;
      pageState.busy = true;
      setLoadingMore(true);
      try {
        const res = await apiService.getUserProgressPage({ cursor: pageState.cursor, pageSize: PAGE_SIZE });
        pageState.cursor = res.cursor;
        pageState.hasMore = res.hasMore;
        setHistoryHasMore(res.hasMore);
        setHistory((prev) => [...prev, ...res.items.filter((n) => !prev.some((p) => p.storyId === n.storyId))]);
      } catch (e) {
        console.warn('History next page:', e?.message);
      } finally {
        pageState.busy = false;
        setLoadingMore(false);
      }
    }
  };

  const onScroll = ({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) loadMore();
  };

  const handleRetry = () => {
    setError(null);
    loadFavorites();
    loadHistory();
  };

  const openStory = (story) => {
    navigation.navigate('StoryDetail', { storyId: story.id, story });
  };

  const EmptyState = ({ icon, title, caption }) => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} size={30} color={theme.accent} />
      </View>
      <AppText variant="h3" style={{ marginTop: 16 }}>{title}</AppText>
      {caption ? (
        <AppText variant="caption" color="textSecondary" style={{ marginTop: 6, textAlign: 'center' }}>
          {caption}
        </AppText>
      ) : null}
    </View>
  );

  const renderFavorites = () => {
    if (stories.length === 0) {
      return (
        <EmptyState
          icon="heart"
          title="No favorites yet"
          caption="Tap the heart on any story to save it here."
        />
      );
    }
    return stories.map((story) => (
      <CompactRow
        key={story.id}
        story={story}
        onPress={() => openStory(story)}
        trailing={<Icon name="bookmark-fill" size={20} color={theme.accent} />}
      />
    ));
  };

  const renderDownloads = () => {
    const entries = Object.values(downloads);
    if (entries.length === 0) {
      return (
        <EmptyState
          icon="download"
          title="No downloads yet"
          caption="Downloaded stories play offline."
        />
      );
    }
    return entries.map((d) => (
      <CompactRow
        key={d.story.id}
        story={d.story}
        onPress={() => playStory({ ...d.story, audioUrl: d.path })}
        trailing={
          <Pressable onPress={() => toggleDownload({ id: d.story.id, audioUrl: d.story.audioUrl })} hitSlop={6}>
            <Icon name="trash" size={18} color={theme.textSecondary} />
          </Pressable>
        }
      />
    ));
  };

  const renderHistory = () => {
    if (history.length === 0) {
      return (
        <EmptyState
          icon="timer"
          title="Nothing played yet"
          caption="Stories you listen to will appear here."
        />
      );
    }
    return history.map((item) => {
      // Normalize progress to a number between 0 and 1
      const rawPct = item.progress;
      const pct = (typeof rawPct === 'number' && isFinite(rawPct))
        ? Math.min(1, Math.max(0, rawPct))
        : 0;
      const subtitle = pct >= 0.98 ? 'Finished' : `${Math.round(pct * 100)}% complete`;
      return (
        <CompactRow
          key={item.storyId}
          story={item}
          subtitle={subtitle}
          onPress={() => openStory({ id: item.storyId, ...item })}
          trailing={
            <AppText variant="caption" color="textTertiary">
              {pct >= 0.98 ? 'Done' : `${Math.round(pct * 100)}%`}
            </AppText>
          }
        />
      );
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={200}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <AppText variant="displayM">Library</AppText>
        </View>

        {/* Segmented control */}
        <View style={[styles.segments, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {SEGMENTS.map((seg) => {
            const isActive = active === seg.key;
            return (
              <Pressable
                key={seg.key}
                onPress={() => setActive(seg.key)}
                style={[
                  styles.segment,
                  isActive && { backgroundColor: theme.accent },
                ]}
              >
                <AppText
                  variant="label"
                  color={isActive ? 'onAccent' : 'textSecondary'}
                  style={{ fontSize: 14 }}
                >
                  {seg.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.pane}>
          {error ? (
            <View style={styles.errorContainer}>
              <View style={[styles.errorIcon, { backgroundColor: theme.errorSoft }]}>
                <Icon name="alert-circle" size={32} color={theme.error} />
              </View>
              <AppText variant="body" color="error" style={styles.errorText}>{error}</AppText>
              <Pressable onPress={handleRetry} style={[styles.retryBtn, { backgroundColor: theme.accent }]}>
                <AppText variant="label" color="onAccent">Retry</AppText>
              </Pressable>
            </View>
          ) : (contextLoading || loading) && active === 'favorites' ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
          ) : active === 'favorites' ? (
            renderFavorites()
          ) : active === 'downloads' ? (
            renderDownloads()
          ) : (
            renderHistory()
          )}
          {loadingMore && ((active === 'favorites' && favoritesHaveMore) || (active === 'history' && historyHasMore)) ? (
            <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  segments: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 8,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  pane: { paddingTop: 8, minHeight: 300 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 70,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 12,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
});
