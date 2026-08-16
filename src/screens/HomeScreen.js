// Home Screen for Story Byte
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppContext } from '../context/AppContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../hooks/useTheme';
import apiService from '../services/api';

// Deterministic placeholder cover (no Math.random in render → no reload flicker).
const PLACEHOLDER_COLORS = ['667eea', 'ec4899', '8b5cf6', '10b981', 'f59e0b'];
const placeholderFor = (title = '') => {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash + title.charCodeAt(i)) % PLACEHOLDER_COLORS.length;
  const color = PLACEHOLDER_COLORS[hash];
  const label = encodeURIComponent((title || 'Story').substring(0, 10));
  return `https://placehold.co/400x300/${color}/ffffff?text=${label}`;
};

// Renders a story cover and falls back to a placeholder if coverImage is
// missing OR fails to load (e.g. an expired/gs:// URL) — the old code left
// broken covers permanently blank.
const StoryCover = ({ coverImage, title, style }) => {
  const [failed, setFailed] = useState(false);
  const uri = !coverImage || failed ? placeholderFor(title) : coverImage;
  return <Image source={{ uri }} style={style} onError={() => setFailed(true)} />;
};

export const HomeScreen = () => {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { playStory } = useAudioPlayer();
  const { user, loading: authLoading } = useAppContext();
  const [stories, setStories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');

  useEffect(() => {
    loadStories();
    loadCategories();
  }, []);

  const loadStories = async (category = 'All', language = 'All') => {
    try {
      setLoading(true);
      const params = {};
      if (category !== 'All') params.genre = category;
      if (language !== 'All') params.language = language;

      const response = await apiService.getStories(params);
      setStories(response.stories || []);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiService.getCategories();
      setCategories(response.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStories(selectedCategory, selectedLanguage);
  };

  const handlePlayStory = async (story) => {
    await playStory(story);
    await apiService.playStory(story.id);
  };

  const renderStoryCard = (story) => (
    <TouchableOpacity
      key={story.id}
      style={styles.storyCard}
      onPress={() => navigation.navigate('StoryDetail', { storyId: story.id })}
    >
      <View style={styles.storyImageContainer}>
        <StoryCover coverImage={story.coverImage} title={story.title} style={styles.storyImage} />
        <View style={styles.storyDuration}>
          <Text style={styles.durationText}>{formatDuration(story.duration)}</Text>
        </View>
      </View>
      <View style={styles.storyContent}>
        <Text style={[styles.storyTitle, { color: theme.text }]} numberOfLines={2}>
          {story.title}
        </Text>
        <Text style={[styles.storyDescription, { color: theme.textSecondary }]} numberOfLines={2}>
          {story.description}
        </Text>
        <View style={styles.storyMeta}>
          <View style={styles.storyTags}>
            <Text style={[styles.tag, { backgroundColor: theme.accent + '20', color: theme.accent }]}>
              {story.genre || 'story'}
            </Text>
            <Text style={[styles.tag, { backgroundColor: theme.accent + '20', color: theme.accent }]}>
              {(story.language || '').toUpperCase() || '—'}
            </Text>
          </View>
          <Text style={[styles.plays, { color: theme.textSecondary }]}>
            ▶ {story.plays}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>StoryByte</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                Your daily dose of stories
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={{ fontSize: 20 }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Language Filter */}
        <View style={styles.filterContainer}>
          {['All', 'EN', 'HI'].map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.filterButton,
                selectedLanguage === lang && { backgroundColor: theme.accent }
              ]}
              onPress={() => {
                setSelectedLanguage(lang);
                loadStories(selectedCategory, lang);
              }}
            >
              <Text style={[styles.filterText, { color: selectedLanguage === lang ? '#fff' : theme.textSecondary, backgroundColor: selectedLanguage !== lang ? theme.surface : 'transparent' }]}>
                {lang}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Categories */}
        <View style={[styles.section, { borderTopColor: theme.divider }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Categories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                style={[
                  styles.categoryButton,
                  selectedCategory === cat.name && { backgroundColor: theme.accent }
                ]}
                onPress={() => {
                  setSelectedCategory(cat.name);
                  loadStories(cat.name, selectedLanguage);
                }}
              >
                <Text style={[styles.categoryText, { color: selectedCategory === cat.name ? '#fff' : theme.text, backgroundColor: selectedCategory !== cat.name ? theme.surface : 'transparent' }]}>
                  {cat.name}
                </Text>
                <Text style={[styles.categoryCount, { color: selectedCategory === cat.name ? '#fff' : theme.textSecondary }]}>
                  {cat.count}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stories List */}
        <View style={[styles.section, { borderTopColor: theme.divider, backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {selectedCategory === 'All' ? 'Latest Stories' : `${selectedCategory} Stories`}
          </Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={{ color: theme.textSecondary }}>Loading...</Text>
            </View>
          ) : stories.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ color: theme.textSecondary }}>No stories found</Text>
            </View>
          ) : (
            stories.map(renderStoryCard)
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  header: {
    padding: 20,
    paddingTop: 40
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold'
  },
  headerSubtitle: {
    fontSize: 16,
    marginTop: 4
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600'
  },
  section: {
    padding: 15,
    borderTopWidth: 1
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15
  },
  categoryScroll: {
    flexDirection: 'row'
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    minWidth: 80,
    alignItems: 'center'
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600'
  },
  categoryCount: {
    fontSize: 12,
    marginTop: 2
  },
  storyCard: {
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  storyImageContainer: {
    position: 'relative'
  },
  storyImage: {
    width: '100%',
    height: 180
  },
  storyDuration: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  storyContent: {
    padding: 15
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8
  },
  storyDescription: {
    fontSize: 14,
    marginBottom: 10
  },
  storyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  storyTags: {
    flexDirection: 'row',
    gap: 8
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12
  },
  plays: {
    fontSize: 12
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyState: {
    padding: 40,
    alignItems: 'center'
  }
});