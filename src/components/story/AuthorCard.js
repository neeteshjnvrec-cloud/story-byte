// The story page's author: who wrote it (WRITTEN BY, under the description)
// and their other stories (MORE FROM …, at the end of the page). A
// community story shows its listener-author and how many stories they've
// published; the daily library and the YouTube videos show StoryByte.
import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import apiService from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../ui/AppText';
import { RailCard } from './StoryCard';

/** The author's other published stories (community stories only). */
export function useAuthorStories(story) {
  const authorId = story?.isCommunityStory ? story.authorId : null;
  const [stories, setStories] = useState([]);
  useEffect(() => {
    let alive = true;
    setStories([]);
    if (authorId) {
      apiService.getStoriesByAuthor(authorId, 50)
        .then((list) => { if (alive) setStories(list); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [authorId]);
  return stories;
}

export function AuthorRow({ story, name, stories }) {
  const { theme } = useTheme() || { theme: {} };
  const community = !!story?.isCommunityStory;
  const pic = community ? story.authorProfilePic : null;
  const count = stories.length;
  const subtitle = community
    ? `Community storyteller${count ? ` · ${count >= 50 ? '50+' : count} ${count === 1 ? 'story' : 'stories'}` : ''}`
    : story?.youtubeId && !story?.audioUrl ? 'StoryByte original · video' : 'StoryByte original · AI-narrated';
  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
        {pic ? (
          <Image source={{ uri: pic }} style={styles.avatarImage} contentFit="cover" transition={100} />
        ) : (
          <AppText variant="h3" color="onAccent">{(name || '?')[0].toUpperCase()}</AppText>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="micro" color="textTertiary" style={{ letterSpacing: 1.2 }}>WRITTEN BY</AppText>
        <AppText variant="bodySemi" numberOfLines={1} style={{ marginTop: 2 }}>{name}</AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>{subtitle}</AppText>
      </View>
    </View>
  );
}

export function MoreFromAuthor({ story, name, stories }) {
  const navigation = useNavigation();
  const others = stories.filter((s) => s.id !== story?.id).slice(0, 10);
  if (!others.length) return null;
  return (
    <View style={{ marginTop: 26 }}>
      <AppText variant="micro" color="textTertiary" numberOfLines={1} style={{ letterSpacing: 1.2, marginBottom: 12 }}>
        MORE FROM {String(name).toUpperCase()}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {others.map((s) => (
          <RailCard key={s.id} story={s} onPress={() => navigation.push('StoryDetail', { storyId: s.id, story: s })} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 12, borderRadius: 16, borderWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
});
