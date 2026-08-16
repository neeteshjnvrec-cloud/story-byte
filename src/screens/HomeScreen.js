// Home — vertical-driven feed: hero + Continue listening + rails by genre.
import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppContext } from '../context/AppContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { Hero, RailCard } from '../components/story/StoryCard';
import apiService from '../services/api';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

async function apiSafe(fn, fallback) {
  try { return await fn(); } catch (e) { console.warn('Home load:', e?.message); return fallback; }
}

export const HomeScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, tokens } = useTheme();
  const { playStory } = useAudioPlayer();
  const [stories, setStories] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState('All');

  const load = useCallback(async (lang = 'All') => {
    try {
      const params = lang !== 'All' ? { language: lang } : {};
      const [res, prog] = await Promise.all([
        apiSafe(() => apiService.getStories(params), { stories: [] }),
        apiSafe(() => apiService.getUserProgress(), []),
      ]);
      setStories(res.stories || []);
      setProgress((prog || []).filter((p) => (p.progress || 0) < 0.98).slice(0, 10));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(language); }, []);

  const onRefresh = () => { setRefreshing(true); load(language); };
  const pickLang = (l) => { setLanguage(l); setLoading(true); load(l); };

  const openStory = (s) => navigation.navigate('StoryDetail', { storyId: s.id, story: s });
  const play = async (s) => { await playStory(s); };

  const hero = stories[0];
  const genres = [...new Set(stories.map((s) => s.genre).filter(Boolean))];
  const rails = genres.length
    ? genres.map((g) => ({ title: cap(g), items: stories.filter((s) => s.genre === g) }))
    : (stories.length ? [{ title: 'Latest stories', items: stories }] : []);

  const s = styles(theme, tokens);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <AppText variant="displayM"><AppText variant="displayM" color="accent">Story</AppText>Byte</AppText>
        <View style={s.headerIcons}>
          <Pressable onPress={() => navigation.navigate('Browse')} hitSlop={8}><Icon name="search" /></Pressable>
          <Pressable hitSlop={8}><Icon name="bell" /></Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}><Icon name="gear" /></Pressable>
        </View>
      </View>

      {/* Language chips */}
      <View style={s.chips}>
        {['All', 'EN', 'HI'].map((l) => {
          const on = language === l;
          return (
            <Pressable key={l} onPress={() => pickLang(l)}
              style={[s.chip, on && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
              <AppText variant="label" color={on ? 'onAccent' : 'textSecondary'}>{l}</AppText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.accent} /></View>
      ) : stories.length === 0 ? (
        <View style={s.center}>
          <Icon name="book" size={40} color={theme.textTertiary} />
          <AppText variant="body" color="textSecondary" style={{ marginTop: 12 }}>No stories yet — check back soon.</AppText>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 150 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        >
          {hero ? (
            <Hero story={hero} onPress={() => openStory(hero)} onPlay={() => play(hero)} />
          ) : null}

          {progress.length ? (
            <>
              <SectionHeader theme={theme} title="Continue listening" />
              <Rail items={progress} onOpen={openStory} onPlay={play} />
            </>
          ) : null}

          {rails.map((r) => (
            <View key={r.title}>
              <SectionHeader theme={theme} title={r.title} />
              <Rail items={r.items} onOpen={openStory} onPlay={play} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

function SectionHeader({ theme, title, action }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 }}>
      <AppText variant="h2">{title}</AppText>
      {action ? <AppText variant="micro" color="accent">SEE ALL</AppText> : null}
    </View>
  );
}

function Rail({ items, onOpen, onPlay }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
      {items.map((it, i) => (
        <RailCard key={it.id || it.storyId || i} story={it} onPress={() => onOpen(it)} onPlay={() => onPlay(it)} />
      ))}
    </ScrollView>
  );
}

const styles = (theme, tokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
});

export default HomeScreen;
