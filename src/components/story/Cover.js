// Cover — a story's artwork. Uses the real coverImage (cached via expo-image)
// when present; otherwise renders a warm genre-keyed gradient placeholder so
// the UI always looks intentional (real illustrated covers arrive from the
// content pipeline later).
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';

const SCENES = {
  adventure: ['#9BD9EC', '#C4EBDE', '#8FCB86'],
  romance: ['#F6B24B', '#EE8B4B', '#C85C6B'],
  mystery: ['#3A2E66', '#5B3E86', '#8B4E86'],
  thriller: ['#2B2E63', '#4B3B77', '#6E4E86'],
  scifi: ['#3A2E66', '#4E5B9E', '#6E8FD8'],
  horror: ['#241C30', '#3A2E44', '#5B3E66'],
  fantasy: ['#8BD0AE', '#4E9E86', '#2F6E5B'],
  fairytale: ['#F7C05A', '#EE9E6B', '#D07C8A'],
  sleep: ['#2B2E63', '#4B3B77', '#6E4E86'],
  calm: ['#8FD3E8', '#BFE9E0', '#9AD9C6'],
  hindi: ['#F7C05A', '#EE8B4B', '#C85C6B'],
  kids: ['#FFD98A', '#FF9E7C', '#FF6B6B'],
};

function gradientFor(key, theme) {
  if (!key) return [theme.gradientStart, theme.gradientMid, theme.gradientEnd];
  const k = String(key).toLowerCase().replace(/[^a-z]/g, '');
  return SCENES[k] || [theme.gradientStart, theme.gradientMid, theme.gradientEnd];
}

export function Cover({ story = {}, sceneKey, style, radius = 16, children }) {
  const { theme } = useTheme();
  const uri = story.coverImage || story.coverUrl;
  const key = sceneKey || story.vertical || story.genre || story.language;
  const colors = gradientFor(key, theme);

  return (
    <View style={[styles.wrap, { borderRadius: radius, backgroundColor: theme.card }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <LinearGradient colors={colors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', position: 'relative' },
});

export default Cover;
