// Onboarding Screen for Story Byte
// First-time user walkthrough
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Cover } from '../components/story/Cover';

const slides = [
  {
    id: '1',
    title: 'Bedtime tales, on tap',
    subtitle: 'Thousands of short audio stories — for winding down, the commute, and the kids.',
    sceneKey: 'bedtime',
  },
  {
    id: '2',
    title: 'Made for your moments',
    subtitle: 'Pick a genre or a language and let a calm narrator do the rest.',
    sceneKey: 'calm',
  },
  {
    id: '3',
    title: 'Right where you left off',
    subtitle: 'Resume any story across your devices, even when you are offline.',
    sceneKey: 'kids',
  },
];

export const OnboardingScreen = ({ onComplete }) => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem('storybyte-onboarding-complete', 'true');
    } catch (e) {
      // Silent fail
    }
    if (onComplete) {
      onComplete();
    } else {
      navigation.replace('Login');
    }
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleGetStarted();
    }
  };

  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.center}>
        <Cover sceneKey={slide.sceneKey} radius={30} style={styles.illustration} />
        <AppText variant="displayM" style={styles.title}>{slide.title}</AppText>
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          {slide.subtitle}
        </AppText>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i === currentIndex ? 26 : 8,
                  backgroundColor: i === currentIndex ? theme.accent : theme.border,
                },
              ]}
            />
          ))}
        </View>

        <Button title={isLast ? 'Get started' : 'Continue'} onPress={handleNext} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 190,
    height: 190,
  },
  title: {
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 24,
    maxWidth: 320,
  },
  footer: {
    gap: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});

export default OnboardingScreen;
