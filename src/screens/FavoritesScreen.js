// Library Screen for Story Byte — Favorites / Downloads / History.
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import apiService from '../services/api';
import { useAudioPlayer } from '../context/AudioContext';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { CompactRow } from '../components/story/StoryCard';

const SEGMENTS = [
  { key: 'favorites', label: 'Favorites' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'history', label: 'History' },
];

export const FavoritesScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme() || { theme: {} };
  const insets = useSafeAreaInsets();
  const { favorites, loading: contextLoading } = useAppContext();
  const { playStory } = useAudioPlayer();
  const [stories, setStories] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('favorites');

  useEffect(() => {
    loadFavorites();
    loadHistory();
  }, [favorites]);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const favoriteStoryIds = favorites.map(f => f.storyId || f.id);
      const favoriteStories = await Promise.all(
        favoriteStoryIds.map(id => apiService.getStory(id))
      );
      setStories(favoriteStories.filter(Boolean));
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const progress = await apiService.getUserProgress();
      setHistory(progress || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
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
        trailing={<Icon name="heart-fill" size={20} color={theme.error} />}
      />
    ));
  };

  const renderDownloads = () => (
    <EmptyState
      icon="download"
      title="No downloads yet"
      caption="Downloaded stories play offline."
    />
  );

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
          {(contextLoading || loading) && active === 'favorites' ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
          ) : active === 'favorites' ? (
            renderFavorites()
          ) : active === 'downloads' ? (
            renderDownloads()
          ) : (
            renderHistory()
          )}
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
});
