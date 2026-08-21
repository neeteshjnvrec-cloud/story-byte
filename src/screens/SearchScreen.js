// Browse Screen for Story Byte
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../hooks/useTheme';
import apiService from '../services/api';
import { AppText } from '../components/ui/AppText';
import { Input } from '../components/ui/Input';
import { Icon } from '../components/ui/Icon';
import { Cover } from '../components/story/Cover';
import { CompactRow, fmtMin } from '../components/story/StoryCard';

// Single-select filter pills.
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'en', label: 'EN' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'short', label: '‹5 min' },
  { id: 'long', label: '15+ min' },
];

// 2x2 vertical tiles (real banner art hosted on Firebase Hosting; falls back
// to the gradient sceneKey if an image fails to load).
const CDN = 'https://storybyte-76716.web.app/verticals';
const VERTICALS = [
  { key: 'fiction', label: 'Fiction', img: `${CDN}/fiction.jpg` },
  { key: 'bedtime', label: 'Bedtime', img: `${CDN}/bedtime.jpg` },
  { key: 'kids', label: 'Kids', img: `${CDN}/kids.jpg` },
  { key: 'hindi', label: 'Hindi', img: `${CDN}/hindi.jpg` },
];

// Genre chips → mapped to existing GENRES ids used by getStories({ genre }).
import { GENRES } from '../constants/genres';

// Genre chips
const GENRE_CHIPS = GENRES;

export const SearchScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme() || { theme: {} };
  const insets = useSafeAreaInsets();
  const { playStory } = useAudioPlayer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute search whenever debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length > 0) {
      performSearch(debouncedQuery.trim());
    } else if (!hasSearched) {
      setResults([]);
    }
  }, [debouncedQuery]);

  const performSearch = useCallback(async (searchQuery) => {
    try {
      setLoading(true);
      setHasSearched(true);
      setSelectedGenre(null);
      Keyboard.dismiss();

      // Get every published story — daily and community — and filter client-side
      // (Firestore can't do full-text search).
      const response = await apiService.getStories({ limit: 200, community: 'all' });
      const allStories = response.stories || [];

      const lowerQuery = searchQuery.toLowerCase();
      const matched = allStories.filter((s) => {
        const title = (s.title || '').toLowerCase();
        const genre = (s.genre || '').toLowerCase();
        const desc = (s.description || '').toLowerCase();
        return title.includes(lowerQuery) ||
               genre.includes(lowerQuery) ||
               desc.includes(lowerQuery);
      });

      setResults(matched);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenrePress = async (genre) => {
    setQuery('');
    setSelectedGenre(genre.id);
    try {
      setLoading(true);
      setHasSearched(true);
      const response = await apiService.getStories({ genre: genre.id, limit: 200, community: 'all' });
      setResults(response.stories || []);
    } catch (error) {
      console.error('Genre search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter chips. Language ones use the existing getStories({ language }) filter;
  // duration ones filter the loaded set client-side via displayResults.
  const handleFilterPress = async (id) => {
    setFilter(id);
    if (id === 'en' || id === 'hi') {
      try {
        setLoading(true);
        setHasSearched(true);
        const response = await apiService.getStories({ language: id, limit: 200, community: 'all' });
        setResults(response.stories || []);
      } catch (error) {
        console.error('Language filter error:', error);
      } finally {
        setLoading(false);
      }
    } else if (id === 'all') {
      // Reset genre filter and load all stories
      setSelectedGenre(null);
      setHasSearched(false);
      try {
        setLoading(true);
        const response = await apiService.getStories({ limit: 200, community: 'all' });
        setResults(response.stories || []);
      } catch (error) {
        console.error('All filter error:', error);
      } finally {
        setLoading(false);
      }
    } else if ((id === 'short' || id === 'long') && !hasSearched) {
      // Nothing loaded yet — pull the catalog so the duration filter has data.
      try {
        setLoading(true);
        setHasSearched(true);
        const response = await apiService.getStories({ limit: 200, community: 'all' });
        setResults(response.stories || []);
      } catch (error) {
        console.error('Duration filter error:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleVerticalPress = async (v) => {
    setLoading(true);
    setHasSearched(true);
    setSelectedGenre(null);
    try {
      const response = await apiService.getStories({ vertical: v.key, limit: 200, community: 'all' });
      setResults(response.stories || []);
    } catch (error) {
      console.error('Vertical filter error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStoryPress = (story) => {
    navigation.navigate('StoryDetail', { storyId: story.id, story });
  };

  const handlePlayStory = async (story) => {
    await playStory(story);
    navigation.navigate('Home');
    // Small delay so the Home tab activates before navigating to detail
    setTimeout(() => {
      navigation.navigate('StoryDetail', { storyId: story.id });
    }, 100);
  };

  // Apply the active chip on top of whatever result set is loaded.
  const displayResults = results.filter((s) => {
    const lang = (s.language || '').toLowerCase();
    if (filter === 'en') return lang === 'en';
    if (filter === 'hi') return lang === 'hi';
    if (filter === 'short') return s.duration && s.duration < 300;
    if (filter === 'long') return s.duration && s.duration >= 900;
    return true;
  });

  const showResults = hasSearched || debouncedQuery.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <AppText variant="displayM">Browse</AppText>
        </View>

        {/* Search Input */}
        <View style={styles.block}>
          <Input
            icon="search"
            placeholder="Search stories, narrators…"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => query.trim() && performSearch(query.trim())}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={{ marginBottom: 0 }}
          />
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chipRow}
        >
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => handleFilterPress(f.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? theme.accent : theme.card,
                    borderColor: on ? theme.accent : theme.border,
                  },
                ]}
              >
                <AppText variant="label" color={on ? 'onAccent' : 'textSecondary'} style={{ fontSize: 14 }}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}

        {!loading && !showResults && (
          <>
            {/* Verticals */}
            <View style={styles.section}>
              <AppText variant="h2" style={styles.sectionTitle}>Verticals</AppText>
              <View style={styles.verticalGrid}>
                {VERTICALS.map((v) => (
                  <Pressable key={v.key} style={styles.vTile} onPress={() => handleVerticalPress(v)}>
                    <Cover story={{ coverImage: v.img }} sceneKey={v.key} radius={18} style={styles.vCover}>
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.5)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.vLabel}>
                        <AppText variant="h3" numberOfLines={1} style={{ color: '#fff' }}>{v.label}</AppText>
                      </View>
                    </Cover>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Genres */}
            <View style={styles.section}>
              <AppText variant="h2" style={styles.sectionTitle}>Genres</AppText>
              <View style={styles.genreWrap}>
                {GENRE_CHIPS.map((g) => {
                  const on = selectedGenre === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => handleGenrePress(g)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: on ? theme.accent : theme.card,
                          borderColor: on ? theme.accent : theme.border,
                        },
                      ]}
                    >
                      <AppText variant="label" color={on ? 'onAccent' : 'textSecondary'} style={{ fontSize: 14 }}>
                        {g.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* Search Results */}
        {!loading && showResults && (
          <View style={styles.section}>
            <AppText variant="h2" style={styles.sectionTitle}>
              {displayResults.length > 0 ? `${displayResults.length} results` : 'No stories found'}
            </AppText>

            {displayResults.map((story) => (
              <CompactRow
                key={story.id}
                story={story}
                onPress={() => handleStoryPress(story)}
                subtitle={`${story.genre || 'Story'}${story.language ? ` · ${String(story.language).toUpperCase()}` : ''}${story.duration ? ` · ${fmtMin(story.duration)}` : ''}`}
                trailing={
                  <Pressable
                    onPress={() => handlePlayStory(story)}
                    hitSlop={8}
                    style={[styles.playBtn, { backgroundColor: theme.accentSoft }]}
                    accessibilityLabel="Play"
                  >
                    <Icon name="play" size={16} color={theme.accent} />
                  </Pressable>
                }
              />
            ))}

            {displayResults.length === 0 && (
              <AppText variant="body" color="textSecondary" style={styles.emptyText}>
                Try different keywords or browse verticals and genres.
              </AppText>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  block: {
    paddingHorizontal: 20,
  },
  chipRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  sectionTitle: {
    marginBottom: 14,
  },
  verticalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  vTile: {
    width: '48%',
    marginBottom: 14,
  },
  vCover: {
    height: 100,
  },
  vLabel: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    right: 14,
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 16,
  },
});
