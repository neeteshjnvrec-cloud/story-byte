/**
 * Root entry for StoryByte (loaded by expo/AppEntry.js).
 *
 * Wires auth routing + tab navigator into a stack (so the StoryDetail route
 * resolves), inside the app-wide providers. ThemeProvider must wrap the tree so
 * every screen's useTheme() reads real theme state (and the Settings appearance
 * toggle actually works) instead of falling back. The FloatingAudioPlayer
 * renders above the navigators so playback keeps working across screens.
 */
import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppContextProvider, useAppContext } from './src/context/AppContext';
import { AudioProvider } from './src/context/AudioContext';
import { ThemeProvider } from './src/hooks/useTheme';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StoryDetailScreen } from './src/screens/StoryDetailScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { SignupScreen } from './src/screens/auth/SignupScreen';
import { ForgotPasswordScreen } from './src/screens/auth/ForgotPasswordScreen';
import { ProfileSetupScreen } from './src/screens/auth/ProfileSetupScreen';
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { NotificationButton } from './src/components/NotificationButton';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { NotificationProvider } from './src/context/NotificationContext';
import { FloatingAudioPlayer } from './src/components/FloatingAudioPlayer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { FONT_MAP } from './src/theme/tokens';
import { ErrorBoundary } from './src/components/ErrorBoundary';

const Stack = createNativeStackNavigator();

// Check if user has completed onboarding
async function checkOnboardingStatus() {
  try {
    const completed = await AsyncStorage.getItem('storybyte-onboarding-complete');
    return completed === 'true';
  } catch (e) {
    return false;
  }
}

// Auth stack shown when the user is signed out.
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}

// Main app stack shown when signed in: 4 tabs + StoryDetail + Settings + Onboarding
function MainStack({ isNewUser }) {
  const navigationRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);
  const { userStats } = useAppContext();

  // Check if mandatory profile fields are filled
  const needsProfile = React.useMemo(() => {
    if (!userStats) return true; // no data yet = needs profile
    return !userStats.fullName || !userStats.gender || !userStats.favoriteGenre;
  }, [userStats]);

  // Auto-open EditProfile when profile is incomplete
  React.useEffect(() => {
    if (needsProfile && ready && navigationRef.current) {
      navigationRef.current.navigate('EditProfile');
    }
  }, [needsProfile, ready]);

  return (
    <>
      <Stack.Navigator
        ref={navigationRef}
        screenOptions={{ headerShown: false }}
        onReady={() => setReady(true)}
      >
        <Stack.Screen name="Main" component={AppNavigator} />
        <Stack.Screen name="StoryDetail" component={StoryDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal' }} />
        {isNewUser ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        ) : null}
      </Stack.Navigator>
      <FloatingAudioPlayer />
    </>
  );
}

function Root() {
  const { user, loading, userStats } = useAppContext();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    checkOnboardingStatus().then(setHasCompletedOnboarding);
  }, []);

  // Show a minimal splash while auth state is being restored.
  if (loading) {
    return null;
  }

  // New user flow: show onboarding before main app
  if (user && !hasCompletedOnboarding && !isFirstLogin) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <OnboardingScreen onComplete={() => setIsFirstLogin(true)} />
      </GestureHandlerRootView>
    );
  }

  return user ? <MainStack isNewUser={false} /> : <AuthStack />;
}

export default function App() {
  const [fontsLoaded] = useFonts(FONT_MAP);

  // Hold on the native splash until fonts are ready to avoid a text flash.
  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AppContextProvider>
              <AudioProvider>
                <NotificationProvider>
                  <NavigationContainer>
                  <StatusBar style="auto" />
                  <Root />
                </NavigationContainer>
                </NotificationProvider>
              </AudioProvider>
            </AppContextProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
