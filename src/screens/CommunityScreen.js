// Community Screen - Displays user-generated stories from the community
import React, { useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { StoryCard } from '../components';
import { useAppContext } from '../context/AppContext';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { HeaderNotificationButton } from '../components/HeaderNotificationButton';

export function CommunityScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { communityStories, isGenerating, fetchCommunityStories } = useAppContext();

  useEffect(() => {
    fetchCommunityStories();
  }, [fetchCommunityStories]);

  const handleStoryPress = (story) => {
    navigation.navigate('StoryDetail', { storyId: story.storyId || story.id, story });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <AppText variant="displayM">
          <AppText variant="displayM" color="accent">Story</AppText>Byte
        </AppText>
        <View style={styles.headerIcons}>
          <HeaderNotificationButton size={22} color={theme.text} />
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
            <Icon name="gear" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      {isGenerating ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading stories...
          </Text>
        </View>
      ) : (
        <FlatList
          data={communityStories}
          keyExtractor={(item, index) => item.storyId || item.id || `story-key-${index}`}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleStoryPress(item)} activeOpacity={0.9}>
              <StoryCard story={item} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="people" size={48} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No community stories yet. Be the first to create one!
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 12,
  },
});
