// Favorites Screen for Story Byte
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import apiService from '../services/api';
import { useAudioPlayer } from '../context/AudioContext';

export const FavoritesScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { favorites, loading: contextLoading } = useAppContext();
  const { playStory } = useAudioPlayer();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
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

  const handlePlayStory = async (story) => {
    await playStory(story);
    navigation.navigate('StoryDetail', { storyId: story.id });
  };

  if (contextLoading || loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Favorites</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {stories.length} saved stories
          </Text>
        </View>

        {stories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🤍</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No favorites yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Tap the heart icon on stories to save them here
            </Text>
          </View>
        ) : (
          stories.map((story) => (
            <TouchableOpacity
              key={story.id}
              style={[styles.storyCard, { backgroundColor: theme.card }]}
              onPress={() => handlePlayStory(story)}
            >
              <View style={styles.storyHeader}>
                <Text style={[styles.storyTitle, { color: theme.text }]} numberOfLines={1}>
                  {story.title}
                </Text>
                <Text style={[styles.storyGenre, { color: theme.accent }]}>
                  {story.genre}
                </Text>
              </View>
              <Text style={[styles.storyDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                {story.description}
              </Text>
              <View style={styles.storyFooter}>
                <Text style={[styles.storyDuration, { color: theme.textSecondary }]}>
                  {formatDuration(story.duration)}
                </Text>
                <TouchableOpacity
                  style={[styles.playButton, { backgroundColor: theme.accent }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePlayStory(story);
                  }}
                >
                  <Text style={styles.playButtonText}>Play</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  title: {
    fontSize: 28,
    fontWeight: 'bold'
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10
  },
  storyCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1
  },
  storyGenre: {
    fontSize: 14,
    marginLeft: 10
  },
  storyDescription: {
    fontSize: 14,
    marginBottom: 12
  },
  storyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  storyDuration: {
    fontSize: 14
  },
  playButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20
  },
  playButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  }
});