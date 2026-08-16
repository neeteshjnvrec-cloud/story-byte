// Onboarding Screen for Story Byte
// First-time user walkthrough
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';
import { authStyles } from './auth/authStyles';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Welcome to StoryByte',
    subtitle: 'Your personal audio storytelling companion',
    emoji: '📚',
    description: 'Discover thousands of AI-generated stories crafted just for you.',
  },
  {
    id: '2',
    title: 'Personalized Stories',
    subtitle: 'Stories tailored to your interests',
    emoji: '🎧',
    description: 'Choose your favorite genres and languages for daily story recommendations.',
  },
  {
    id: '3',
    title: 'Listen Anywhere',
    subtitle: 'Offline playback & resume sync',
    emoji: '📱',
    description: 'Pick up where you left off, even without an internet connection.',
  },
];

export const OnboardingScreen = ({ onComplete }) => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem('storybyte-onboarding-complete', 'true');
    } catch (e) {
      // Silent fail on onboarding save
    }
    navigation.replace('Login');
  };

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

  const handleSkipOnboarding = () => {
    navigation.replace('Login');
  };

  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;
  const gradientColors = [theme.gradientStart, theme.gradientEnd];

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Slide indicator */}
        <View style={styles.indicatorContainer}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.indicator,
                i === currentIndex && styles.activeIndicator,
                i === currentIndex && { backgroundColor: '#fff' }
              ]}
            />
          ))}
        </View>

        {/* Slide content */}
        <View style={styles.slideContent}>
          <Text style={styles.emoji}>{slide.emoji}</Text>
          <Text style={authStyles.title}>{slide.title}</Text>
          <Text style={[authStyles.subtitle, { color: theme.textSecondary }]}>
            {slide.subtitle}
          </Text>
          <Text style={authStyles.subtitle}>
            {slide.description}
          </Text>
        </View>

        {/* Navigation buttons */}
        <View style={styles.buttonContainer}>
          {isLast ? (
            <TouchableOpacity
              style={[authStyles.primaryButton, { backgroundColor: theme.accent }]}
              onPress={handleGetStarted}
            >
              <Text style={authStyles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[authStyles.primaryButton, { backgroundColor: theme.accent }]}
              onPress={handleNext}
            >
              <Text style={authStyles.primaryButtonText}>Next</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={authStyles.secondaryButton} onPress={handleSkipOnboarding}>
            <Text style={[authStyles.secondaryButtonText]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeIndicator: {
    width: 24,
  },
  slideContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 20,
  },
});

export default OnboardingScreen;