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
import { storyPlays } from '../utils/storyMetrics';
import { HeaderNotificationButton } from '../components/HeaderNotificationButton';
import { FilterModal } from '../components/FilterModal';
import apiService from '../services/api';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

async function apiSafe(fn, fallback) {
  try { return await fn(); } catch (e) { console.warn('Home load:', e?.message); return fallback; }
}

export const HomeScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, tokens } = useTheme();
  const { playStory, setNextStory } = useAudioPlayer();
  const { setLastPlayTab } = useAppContext();
  const [stories, setStories] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState('All');
  const [showFilter, setShowFilter] = useState(false);
  const [activeFilters, setActiveFilters] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async (lang = 'All', filters = null) => {
    setError(null);
    try {
      const params = {};
      if (lang !== 'All') params.language = lang;
      if (filters) {
        if (filters.genre) params.genre = filters.genre;
        if (filters.language) params.language = filters.language;
        if (filters.duration) params.duration = filters.duration;
      }
      const [res, prog] = await Promise.all([
        apiService.getStories({ ...params, community: 'all' }),
        apiService.getUserProgress(),
      ]);
      setStories(res.stories || []);
      setProgress((prog || []).filter((p) => {
        const rawPct = p.progress;
        const pct = (typeof rawPct === 'number' && isFinite(rawPct)) ? rawPct : 0;
        return pct < 0.98;
      }).slice(0, 10));
    } catch (e) {
      console.error('Home load error:', e);
      setError(e?.message || 'Failed to load stories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(language, activeFilters); }, [language, activeFilters]);

  const onRefresh = () => { setRefreshing(true); load(language, activeFilters); };
  const pickLang = (l) => { setLanguage(l); setLoading(true); load(l, activeFilters); };
  const handleFilterApply = (filters) => {
    setActiveFilters(filters);
    setLoading(true);
    load(language, filters);
  };

  const openStory = (s) => navigation.navigate('StoryDetail', { storyId: s.id, story: s });
  const play = async (s) => {
    setLastPlayTab('home');
    setNextStory(() => {
      const idx = stories.findIndex((st) => st.id === s.id);
      if (idx < 0 || idx >= stories.length - 1) return null;
      return stories[idx + 1];
    });
    await playStory(s);
  };
  const handleRetry = () => load(language, activeFilters);

  const hero = stories[0];
  const genres = [...new Set(stories.map((s) => s.genre).filter(Boolean))];
  // storyPlays, not s.plays: community stories carry the count under
  // `playsCount`, so reading the raw field excluded every one of them here.
  const popular = [...stories]
    .filter((s) => storyPlays(s) > 0)
    .sort((a, b) => storyPlays(b) - storyPlays(a))
    .slice(0, 10);
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
          <HeaderNotificationButton size={22} color={theme.text} />
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}><Icon name="gear" /></Pressable>
        </View>
      </View>

      {/* Filter & Language Chips */}
      <View style={s.chipsRow}>
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
        <Pressable onPress={() => setShowFilter(true)} hitSlop={8} style={s.filterBtn}>
          <Icon name="filter" size={22} color={theme.text} />
          {activeFilters && <View style={s.filterDot} />}
        </Pressable>
      </View>

      {error ? (
        <View style={s.errorContainer}>
          <Icon name="alert-circle" size={48} color={theme.error} />
          <AppText variant="body" color="error" style={s.errorText}>{error}</AppText>
          <Pressable onPress={handleRetry} style={[s.retryBtn, { backgroundColor: theme.accent }]}>
            <AppText variant="label" color="onAccent">Retry</AppText>
          </Pressable>
        </View>
      ) : loading ? (
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

          {popular.length > 1 ? (
            <View style={s.section}>
              <AppText variant="h3" style={s.sectionTitle}>Popular</AppText>
              <View style={s.rail}>
                {popular.map((story) => (
                  <RailCard
                    key={story.id}
                    story={story}
                    onPress={() => openStory(story)}
                    onPlay={() => play(story)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {rails.map((rail) => (
            <View key={rail.title} style={s.section}>
              <AppText variant="h3" style={s.sectionTitle}>{rail.title}</AppText>
              <View style={s.rail}>
                {rail.items.slice(0, 5).map((story) => (
                  <RailCard
                    key={story.id}
                    story={story}
                    onPress={() => openStory(story)}
                    onPlay={() => play(story)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={handleFilterApply}
        initialFilters={activeFilters}
      />
    </View>
  );
};

const styles = (theme, tokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    filterBtn: {
      padding: 8,
      position: 'relative',
    },
    filterDot: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#E53E3E',
    },
    chipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    chips: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    section: { marginTop: 20, paddingHorizontal: 16 },
    sectionTitle: { marginBottom: 12, color: theme.text },
    rail: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    errorText: { marginTop: 16, textAlign: 'center' },
    retryBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
  });

export default HomeScreen;
