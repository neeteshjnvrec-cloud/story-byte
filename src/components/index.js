/**
 * Reusable UI Components for StoryByte
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useTheme } from '../hooks/useTheme';

// Story Card Component
export function StoryCard({ story, onPress }) {
  const { theme } = useTheme() || { theme: {} };
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={onPress}>
      <View style={[styles.cardContent, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{story.title}</Text>
        <Text style={[styles.cardGenre, { color: theme.accent }]}>{story.genre}</Text>
        <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>{story.duration ? `${story.duration} min` : ''} • {story.plays || 0} plays</Text>
      </View>
    </TouchableOpacity>
  );
}

// Loading Component
export function Loading({ message = 'Loading...' }) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#667eea" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

// Error Component
export function ErrorMessage({ message, onRetry }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Rating Stars Component
export function RatingStars({ rating, onRate }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.ratingContainer}>
      {stars.map((star) => (
        <TouchableOpacity key={star} onPress={() => onRate(star)}>
          <Text style={star <= rating ? styles.starFilled : styles.starEmpty}>
            {star <= rating ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Empty State Component
export function EmptyState({ message, icon }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{icon || '📭'}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    position: 'relative',
  },
  cardContent: {
    flex: 1,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardGenre: {
    fontSize: 12,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starFilled: {
    fontSize: 24,
    color: '#f39c12',
  },
  starEmpty: {
    fontSize: 24,
    color: '#ddd',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
