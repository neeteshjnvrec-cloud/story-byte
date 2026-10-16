// Create Story Screen - AI Co-Creator Studio
import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { HeaderNotificationButton } from '../components/HeaderNotificationButton';
import { KeyboardAwareScroll } from '../components/ui/KeyboardAvoider';
import { GENRES } from '../constants/genres';
import { LANGUAGES } from '../types/story';
import { myAuthorName } from '../utils/author';

// The language's own name first — that's how a speaker recognises "its" at a
// glance — then the English name in parens for everybody else. Orthography is
// the gloss for English itself, which is why it stays bare.
const LANGUAGE_LABELS = {
  en: 'English', hi: 'हिन्दी (Hindi)', es: 'Español (Spanish)', fr: 'Français (French)',
  de: 'Deutsch (German)', it: 'Italiano (Italian)', pt: 'Português (Portuguese)',
  bn: 'বাংলা (Bengali)', mr: 'मराठी (Marathi)', te: 'తెలుగు (Telugu)', ta: 'தமிழ் (Tamil)',
  gu: 'ગુજરાતી (Gujarati)', ur: 'اردو (Urdu)', kn: 'ಕನ್ನಡ (Kannada)', or: 'ଓଡ଼ିଆ (Odia)', ml: 'മലയാളം (Malayalam)',
};

export function CreateStoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, tokens } = useTheme();
  // Inputs in the app's own font (TextInput otherwise uses Roboto on Android).
  const inputFont = { fontFamily: tokens.type.body.fontFamily };
  const { generateStory, publishCommunityStory, isGenerating, userStats, user } = useAppContext();

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('romance');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [genrePickerVisible, setGenrePickerVisible] = useState(false);
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
      language: selectedLanguage,
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
      const published = await publishCommunityStory({
        ...generatedStory,
        language: selectedLanguage,
        authorName: myAuthorName(user, userStats) || 'Anonymous',
        authorProfilePic: userStats?.profilePic || userStats?.photoURL || '',
      });
      if (published?.limited) {
        Alert.alert('Daily limit', published.message || 'You can publish up to 10 stories per day.');
        setIsPublishing(false);
        return;
      }
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
      // Check for daily limit error
      const errorMessage = error.message || '';
      if (errorMessage.includes('one community story per day')) {
        Alert.alert(
          'Daily Limit Reached ⚠️',
          'You can only publish one community story per day.\n\nYour story has been saved as a draft. You can create another story tomorrow!',
          [
            { text: 'OK', onPress: () => resetForm() },
            { text: 'View Draft', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert(
          'Publishing Error',
          errorMessage || 'Failed to publish story. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setPrompt('');
    setSelectedGenre('romance');
    setSelectedLanguage('en');
    setGeneratedStory(null);
    setIsPreview(false);
  };

  return (
    // Only the scroll view handles the keyboard: wrapping it in a keyboard-
    // avoiding view as well moved everything twice on Android (a big gap
    // above the keyboard and a jumping form).
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

      <KeyboardAwareScroll
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        // Room below the focused field for the Generate button too, so it can
        // be tapped without closing the keyboard.
        bottomOffset={110}
        showsVerticalScrollIndicator={false}
      >
        {!isPreview ? (
          <>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <AppText variant="h1" style={styles.title}>✨ Create Your Story</AppText>
              <AppText variant="body" color="textSecondary">Let AI bring your imagination to life</AppText>
            </View>

            {/* Title Input */}
            <View style={styles.section}>
              <AppText variant="label" style={styles.label}>Title <AppText variant="caption" color="textTertiary">(optional)</AppText></AppText>
              <TextInput
                style={[styles.input, inputFont, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="Give your story a name..."
                placeholderTextColor={theme.textSecondary}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Genre — inline list opens below button */}
            <View style={styles.section}>
              <AppText variant="label" style={styles.label}>Genre</AppText>
              <TouchableOpacity
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => { setGenrePickerVisible(!genrePickerVisible); setLanguagePickerVisible(false); }}
              >
                <AppText variant="body">{GENRES.find((g) => g.id === selectedGenre)?.label || selectedGenre}</AppText>
                <Ionicons name={genrePickerVisible ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              {genrePickerVisible && (
                <View style={[styles.dropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {GENRES.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider || theme.border }}
                      onPress={() => { setSelectedGenre(item.id); setGenrePickerVisible(false); }}
                    >
                      <Ionicons name={item.icon} size={18} color={selectedGenre === item.id ? theme.accent : theme.text} />
                      <AppText variant={selectedGenre === item.id ? 'label' : 'body'} color={selectedGenre === item.id ? 'accent' : 'text'}>{item.label}</AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Language Selection — dropdown because 15 options is too many for a
                scrollable button grid. The label doubles as the picker trigger. */}
            <View style={styles.section}>
              <AppText variant="label" style={styles.label}>Language</AppText>
              <TouchableOpacity
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => { setLanguagePickerVisible(!languagePickerVisible); setGenrePickerVisible(false); }}
              >
                <AppText variant="body">{LANGUAGE_LABELS[selectedLanguage] || selectedLanguage.toUpperCase()}</AppText>
                <Ionicons name={languagePickerVisible ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              {languagePickerVisible && (
                <View style={[styles.dropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {/* nestedScrollEnabled: without it Android won't scroll a list
                      inside the page's own scroll view. */}
                  <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {LANGUAGES.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={{ paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider || theme.border }}
                        onPress={() => { setSelectedLanguage(item); setLanguagePickerVisible(false); setSearchQuery(''); }}
                      >
                        <AppText variant={selectedLanguage === item ? 'label' : 'body'} color={selectedLanguage === item ? 'accent' : 'text'}>{LANGUAGE_LABELS[item] || item.toUpperCase()}</AppText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Prompt Input */}
            <View style={styles.section}>
              <AppText variant="label" style={styles.label}>Your Story Idea</AppText>
              <TextInput
                style={[styles.textArea, inputFont, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
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
              style={[styles.generateButton, styles.raised, {
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
              }, isGenerating && styles.busy]}
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={22} color={theme.onAccent} />
                  <AppText variant="label" color="onAccent" style={styles.buttonLabel}>Generate with AI</AppText>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Preview Header */}
            <View style={styles.previewHeader}>
              <AppText variant="h2">📖 Your Story</AppText>
              <Pressable onPress={() => setIsPreview(false)} style={styles.closeButton}>
                <Icon name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Story Card */}
            <View style={[styles.storyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <AppText variant="h2" style={styles.storyTitle}>{generatedStory?.title || 'Untitled Story'}</AppText>
              <View style={[styles.genreTag, { backgroundColor: theme.primary + '20' }]}>
                <AppText variant="caption" color="primary" style={{ fontWeight: '600' }}>{generatedStory?.genre || 'Story'}</AppText>
              </View>
              <AppText variant="bodyL" style={styles.storyText}>{generatedStory?.text}</AppText>
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
                <AppText variant="label" color="primary" style={styles.buttonLabel}>Edit Story</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.publishButton, styles.raised, {
                  backgroundColor: theme.primary,
                  shadowColor: theme.primary,
                }, isPublishing && styles.busy]}
                onPress={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <>
                    <Icon name="share-social" size={20} color={theme.onAccent} />
                    <AppText variant="label" color="onAccent" style={styles.buttonLabel}>Publish</AppText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAwareScroll>
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
    padding: 18,
    // Room for the mini player above the tab bar (as on the other tabs).
    paddingBottom: 140,
  },
  heroSection: {
    marginBottom: 24,
    paddingTop: 8,
  },
  title: {
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
  },
  dropdown: {
    borderRadius: 12, marginTop: 6, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1.5, width: '100%',
  },
  raised: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  busy: {
    opacity: 0.7,
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonLabel: {
    fontSize: 16,
  },
  optional: {
    fontWeight: '400',
    fontSize: 12,
  },
  langOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  langOptionText: {
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: 360,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1.5,
  },
  dropdownSheet: {
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
    maxHeight: 320,
  },
  dropdownRow: {
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', gap: 10,
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
    lineHeight: 26,
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
