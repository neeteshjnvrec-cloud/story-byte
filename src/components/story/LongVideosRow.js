// Home's "Long stories" row: the full-length episodes and weekly kathas,
// which live on YouTube. They're video stories in Firestore
// (scripts/sync-video-stories.js), so their page has likes, comments and
// the rest; until the first sync, the website's long-videos.json stands in.
// Tapping a card opens its story page, which plays it in YouTube's player
// (screens/StoryDetailScreen.js).
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiService from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';

const LIST_URL = 'https://storybyte-76716.web.app/long-videos.json';
const CARD_WIDTH = 240;

const minutes = (sec) => (sec > 0 ? `${Math.round(sec / 60)} min` : '');

/** A long-videos.json entry as a story (the fallback before the first sync). */
const asStory = (v) => ({
  id: `yt_${v.id}`,
  storyId: `yt_${v.id}`,
  youtubeId: v.id,
  youtubeUrl: v.youtubeUrl,
  title: v.title,
  description: v.description || '',
  genre: v.seriesTitle || 'Long story',
  language: v.language || '',
  duration: v.durationSec || 0,
  coverImage: v.thumbnailHd || v.thumbnail,
  // Shares link to the website's video page.
  pageUrl: `https://storybyte-76716.web.app/video?v=${encodeURIComponent(v.id)}`,
});

function VideoCard({ video }) {
  const { theme } = useTheme() || { theme: {} };
  const navigation = useNavigation();
  // maxresdefault is the sharpest but isn't made for every video; mqdefault always is.
  const fallbackThumb = `https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg`;
  const [thumb, setThumb] = useState(video.coverImage || fallbackThumb);
  return (
    <Pressable
      onPress={() => navigation.navigate('StoryDetail', { storyId: video.id, story: video })}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${video.title}, play video`}
    >
      <View>
        <Image
          source={{ uri: thumb }}
          onError={() => { if (thumb !== fallbackThumb) setThumb(fallbackThumb); }}
          style={styles.thumb}
          resizeMode="cover"
        />
        <View style={styles.badge}>
          <Icon name="play" size={12} color="#fff" />
          <AppText variant="micro" style={{ color: '#fff' }}>YouTube</AppText>
        </View>
        {minutes(video.duration) ? (
          <View style={styles.duration}>
            <AppText variant="micro" style={{ color: '#fff' }}>{minutes(video.duration)}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText variant="label" numberOfLines={2}>{video.title}</AppText>
        {video.description ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={2} style={{ marginTop: 4 }}>
            {video.description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function LongVideosRow({ titleStyle }) {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      let list = await apiService.getVideoStories(5).catch(() => []);
      if (!list.length) {
        const data = await fetch(LIST_URL).then((res) => (res.ok ? res.json() : null)).catch(() => null);
        list = Array.isArray(data?.videos) ? data.videos.slice(0, 5).map(asStory) : [];
      }
      if (alive) setVideos(list);
    })();
    return () => { alive = false; };
  }, []);

  if (!videos.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <AppText variant="h3" style={titleStyle}>Long stories</AppText>
        <AppText variant="caption" color="textSecondary" style={{ marginBottom: 12 }}>Full episodes · video</AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {videos.map((v) => <VideoCard key={v.id} video={v} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16 },
  row: { paddingHorizontal: 16, gap: 12 },
  card: { width: CARD_WIDTH, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  thumb: { width: CARD_WIDTH, height: Math.round((CARD_WIDTH * 9) / 16), backgroundColor: '#000' },
  badge: {
    position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E62117', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  duration: {
    position: 'absolute', right: 8, bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  body: { padding: 10 },
});

export default LongVideosRow;
