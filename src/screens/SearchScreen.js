// Search Screen for Story Byte
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../hooks/useTheme';
import apiService from '../services/api';

const GENRES = [
  { id: 'adventure', icon: '🏔️', label: 'Adventure' },
  { id: 'horror', icon: '👻', label: 'Horror' },
  { id: 'comedy', icon: '😂', label: 'Comedy' },
  { id: 'romance', icon: '💕', label: 'Romance' },
  { id: 'fantasy', icon: '🐉', label: 'Fantasy' },
  { id: 'sci-fi', icon: '🚀', label: 'Sci-Fi' },
  { id: 'mystery', icon: '🔍', label: 'Mystery' },
  { id: 'thriller', icon: '🔪', label: 'Thriller' },
  { id: 'historical', icon: '📜', label: 'Historical' },
  { id: 'fairy-tale', icon: '🧚', label: 'Fairy Tale' },
  { id: 'bed-time', icon: '🌙', label: 'Bed Time' }
];

export const SearchScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { playStory } = useAudioPlayer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

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
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [debouncedQuery]);

  const performSearch = useCallback(async (searchQuery) => {
    try {
      setLoading(true);
      setHasSearched(true);
      Keyboard.dismiss();

      // Get all active stories and filter client-side (Firestore can't do full-text search)
      const response = await apiService.getStories({ limit: 200 });
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
    setQuery(genre.label);
    try {
      setLoading(true);
      setHasSearched(true);
      const response = await apiService.getStories({ genre: genre.id });
      setResults(response.stories || []);
    } catch (error) {
      console.error('Genre search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayStory = async (story) => {
    await playStory(story);
    navigation.navigate('Home');
    // Small delay so the Home tab activates before navigating to detail
    setTimeout(() => {
      navigation.navigate('StoryDetail', { storyId: story.id });
    }, 100);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Search</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Find your perfect story
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search stories..."
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={() => performSearch(query.trim())}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {/* Genre Chips (shown only when not searching) */}
        {!hasSearched && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Browse by Genre</Text>
            <View style={styles.genreGrid}>
              {GENRES.map((genre) => (
                <TouchableOpacity
                  key={genre.id}
                  style={[styles.genreChip, { backgroundColor: theme.surface }]}
                  onPress={() => handleGenrePress(genre)}
                >
                  <Text style={styles.genreIcon}>{genre.icon}</Text>
                  <Text style={[styles.genreLabel, { color: theme.text }]}>{genre.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}

        {/* Search Results */}
        {!loading && hasSearched && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {results.length > 0 ? `${results.length} results` : 'No stories found'}
            </Text>

            {results.map((story) => (
              <TouchableOpacity
                key={story.id}
                style={[styles.resultCard, { backgroundColor: theme.card }]}
                onPress={() => handlePlayStory(story)}
              >
                <View style={styles.resultContent}>
                  <Text style={[styles.resultTitle, { color: theme.text }]} numberOfLines={1}>
                    {story.title}
                  </Text>
                  <Text style={[styles.resultDescription, { color: theme.textSecondary }]} numberOfLines={1}>
                    {story.genre} • {story.language?.toUpperCase()} • {formatDuration(story.duration)}
                  </Text>
                </View>
                <View style={[styles.playBadge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.playBadgeText}>▶</Text>
                </View>
              </TouchableOpacity>
            ))}

            {results.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Try different keywords or browse genres above
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    paddingBottom: 20
  },
  header: {
    padding: 20,
    paddingTop: 40
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold'
  },
  headerSubtitle: {
    fontSize: 16,
    marginTop: 4
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 10
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 50
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 16
  },
  section: {
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20
  },
  genreIcon: {
    fontSize: 16,
    marginRight: 6
  },
  genreLabel: {
    fontSize: 14,
    fontWeight: '600'
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10
  },
  resultContent: {
    flex: 1
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  resultDescription: {
    fontSize: 13
  },
  playBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  playBadgeText: {
    color: '#fff',
    fontSize: 16
  },
  centered: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20
  }
});
