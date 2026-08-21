// Create Story Screen - AI Co-Creator Studio
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { HeaderNotificationButton } from '../components/HeaderNotificationButton';
import { GENRES } from '../constants/genres';

export function CreateStoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { generateStory, publishCommunityStory, isGenerating } = useAppContext();
  
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('romance');
  const [generatedStory, setGeneratedStory] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const scrollRef = useRef(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Missing Prompt', 'Please enter a story idea or prompt.');
      return;
    }

    const result = await generateStory({
      title: title || undefined,
      prompt: prompt.trim(),
      genre: selectedGenre,
    });

    if (result) {
      setGeneratedStory(result);
      setIsPreview(true);
    }
  };

  const handlePublish = async () => {
    if (!generatedStory) return;
    setIsPublishing(true);
    try {
      const published = await publishCommunityStory(generatedStory);
      if (published) {
        // Submitting hands the story to the generation pipeline; it stays
        // invisible (status 'under_review') until narration and cover art are
        // ready, so there is nothing to navigate to and no story id worth
        // offering. Reset the form and confirm with a native Alert — a modal
        // can't be scrolled past or hidden by a layout change, which is how both
        // the old overlay and the inline banner ended up unseen.
        resetForm();
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        Alert.alert(
          'Your story is under review ✨',
          "We're generating the narration and cover art. We'll notify you once it's approved and live.",
          [{ text: 'Got it' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to publish story. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setPrompt('');
    setSelectedGenre('romance');
    setGeneratedStory(null);
    setIsPreview(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <AppText variant="displayM">
          <AppText variant="displayM" color="accent">Story</AppText>Byte
        </AppText>
        <HeaderNotificationButton size={22} color={theme.text} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {!isPreview ? (
          <>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <Text style={[styles.title, { color: theme.text }]}>
                ✨ Create Your Story
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Let AI bring your imagination to life
              </Text>
            </View>

            {/* Title Input */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Title <Text style={[styles.optional, { color: theme.textTertiary }]}>(optional)</Text></Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="Give your story a name..."
                placeholderTextColor={theme.textSecondary}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Genre Selection */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Genre</Text>
              <View style={styles.genreGrid}>
                {GENRES.map((genre) => (
                  <TouchableOpacity
                    key={genre.id}
                    style={[
                      styles.genreButton,
                      { 
                        backgroundColor: selectedGenre === genre.id ? theme.primary : theme.surface,
                        borderColor: selectedGenre === genre.id ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setSelectedGenre(genre.id)}
                  >
                    <Ionicons
                      name={genre.icon}
                      size={18}
                      color={selectedGenre === genre.id ? theme.onAccent : theme.text}
                    />
                    <Text style={[styles.genreLabel, { color: selectedGenre === genre.id ? theme.onAccent : theme.text }]}>
                      {genre.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Prompt Input */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Your Story Idea</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="Describe your story idea... (e.g., A detective finds a watch that stops time for 10 seconds)"
                placeholderTextColor={theme.textSecondary}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={[styles.generateButton, { 
                backgroundColor: theme.primary, 
                opacity: isGenerating ? 0.7 : 1,
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }]}
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={22} color={theme.onAccent} />
                  <Text style={[styles.generateButtonText, { color: theme.onAccent }]}>Generate with AI</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Preview Header */}
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: theme.text }]}>
                📖 Your Story
              </Text>
              <Pressable onPress={() => setIsPreview(false)} style={styles.closeButton}>
                <Icon name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Story Card */}
            <View style={[styles.storyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.storyTitle, { color: theme.text }]}>
                {generatedStory?.title || 'Untitled Story'}
              </Text>
              <View style={[styles.genreTag, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.genreTagText, { color: theme.primary }]}>
                  {generatedStory?.genre || 'Story'}
                </Text>
              </View>
              <Text style={[styles.storyText, { color: theme.text }]}>
                {generatedStory?.text}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.editButton, { 
                  backgroundColor: theme.surface, 
                  borderColor: theme.border,
                  borderWidth: 1.5,
                }]}
                onPress={() => setIsPreview(false)}
              >
                <Icon name="create" size={20} color={theme.primary} />
                <Text style={[styles.buttonText, { color: theme.primary }]}>Edit Story</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.publishButton, {
                  backgroundColor: theme.primary,
                  opacity: isPublishing ? 0.7 : 1,
                  shadowColor: theme.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }]}
                onPress={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <>
                    <Icon name="share-social" size={20} color={theme.onAccent} />
                    <Text style={[styles.buttonText, { color: theme.onAccent }]}>Publish</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heroSection: {
    marginBottom: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  optional: {
    fontWeight: '400',
    fontSize: 12,
  },
  input: {
    fontSize: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  textArea: {
    fontSize: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 120,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  genreLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Preview Styles
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  storyCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  storyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  genreTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  genreTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  storyText: {
    fontSize: 15,
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 20,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  publishButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
