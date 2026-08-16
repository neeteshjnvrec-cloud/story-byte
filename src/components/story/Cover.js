// Cover — a story's artwork. Uses the real coverImage (cached via expo-image)
// when present; otherwise renders a warm genre-keyed gradient placeholder so
// the UI always looks intentional (real illustrated covers arrive from the
// content pipeline later).
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../hooks/useTheme';
import { SceneArt } from './SceneArt';

export function Cover({ story = {}, sceneKey, style, radius = 16, children }) {
  const { theme } = useTheme();
  const uri = story.coverImage || story.coverUrl;
  const key = sceneKey || story.vertical || story.genre || story.language;

  return (
    <View style={[styles.wrap, { borderRadius: radius, backgroundColor: theme.card }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={StyleSheet.absoluteFill}><SceneArt sceneKey={key} /></View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', position: 'relative' },
});

export default Cover;
