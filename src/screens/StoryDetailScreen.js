// Story Detail Screen for Story Byte
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAudioPlayer } from '../context/AudioContext';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import apiService from '../services/api';

export const StoryDetailScreen = () => {
  const route = useRoute();
  const { storyId } = route.params;
  const { theme } = useTheme();
  const { playStory, playPause, progress, isPlaying, currentStory } = useAudioPlayer();
  const { toggleFavorite, isInFavorites, user } = useAppContext();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  useEffect(() => {
    loadStory();
  }, [storyId]);

  const loadStory = async () => {
    try {
      setLoading(true);
      const response = await apiService.getStory(storyId);
      setStory(response);
      if (response.rating) setRating(response.rating);
    } catch (error) {
      console.error('Error loading story:', error);
      Alert.alert('Error', 'Failed to load story');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async () => {
    if (!story) return;

    if (!currentStory || currentStory.id !== story.id) {
      // Different story (or nothing playing) — start fresh
      await playStory(story);
    } else {
      // Same story — toggle play/pause
      await playPause();
    }
  };

  const handleRate = async () => {
    if (!story) return;
    try {
      await apiService.rateStory(story.id, rating, review);
      Alert.alert('Success', 'Rating submitted!');
      setReview('');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit rating');
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please sign in to add favorites');
      return;
    }
    try {
      await toggleFavorite(story);
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  const isFavorite = story ? isInFavorites(story.id) : false;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Loading...</Text>
      </View>
    );
  }

  if (!story) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Story not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Story Image */}
      <Image
        source={{ uri: story.coverImage || `https://placehold.co/400x300/667eea/ffffff?text=${encodeURIComponent(story.title.substring(0, 15))}` }}
        style={styles.coverImage}
      />

      {/* Story Info */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>{story.title}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>{story.description}</Text>

        {/* Meta Info */}
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Genre</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{story.genre}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Language</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{story.language.toUpperCase()}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Duration</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{formatDuration(story.duration)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Plays</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{story.plays}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: theme.accent }]}
            onPress={handlePlay}
          >
            <Text style={styles.playButtonText}>
              {currentStory?.id === story.id && isPlaying ? 'Pause' : 'Play'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.favoriteButton, { borderColor: theme.accent }]}
            onPress={handleFavorite}
          >
            <Text style={[styles.favoriteButtonText, { color: theme.accent }]}>
              {isFavorite ? '❤️' : '🤍'} Favorite
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        {currentStory?.id === story.id && progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.accent }]} />
            </View>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              {formatProgress(progress, story.duration)}
            </Text>
          </View>
        )}

        {/* Rating Section */}
        <View style={styles.ratingSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Rate this Story</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Text style={[styles.star, { fontSize: 30, color: star <= rating ? '#f59e0b' : '#ddd' }]}>
                  {star <= rating ? '⭐' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.rateButton, { backgroundColor: theme.accent }]} onPress={handleRate}>
            <Text style={styles.rateButtonText}>Submit Rating</Text>
          </TouchableOpacity>
        </View>

        {/* Story Text */}
        {story.text && (
          <View style={styles.textSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Story</Text>
            <Text style={[styles.storyText, { color: theme.textSecondary }]}>{story.text}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatProgress = (progress, duration) => {
  const current = Math.floor(progress * duration);
  return `${formatDuration(current)} / ${formatDuration(duration)}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  coverImage: {
    width: '100%',
    height: 250
  },
  content: {
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginBottom: 20
  },
  metaItem: {
    alignItems: 'center'
  },
  metaLabel: {
    fontSize: 12,
    marginBottom: 4
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20
  },
  playButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center'
  },
  playButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  favoriteButton: {
    flex: 1,
    borderWidth: 2,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center'
  },
  favoriteButtonText: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  progressContainer: {
    marginBottom: 20
  },
  progressBar: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%'
  },
  progressText: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4
  },
  ratingSection: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 10
  },
  star: {
    marginHorizontal: 5
  },
  rateButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  rateButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  textSection: {
    marginTop: 20
  },
  storyText: {
    fontSize: 16,
    lineHeight: 24
  }
});