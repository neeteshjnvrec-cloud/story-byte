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
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppContextProvider, useAppContext } from './src/context/AppContext';
import { AudioProvider } from './src/context/AudioContext';
import { WalletProvider } from './src/context/WalletContext';
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
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { CoinsScreen } from './src/screens/CoinsScreen';
import { VideoScreen } from './src/screens/VideoScreen';
import { FloatingAudioPlayer } from './src/components/FloatingAudioPlayer';
import { notificationService } from './src/services/notificationService';
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
function MainStack({ isNewUser, navigationRef, ready }) {
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

  // Tapping a push notification opens the story it's about. Without this a push
  // just brought the app to whatever screen it was last on, which made the
  // publish/broadcast notifications feel broken even when they arrived.
  //
  // We reset to the Main tab navigator first so StoryDetail sits on top of a
  // real stack — otherwise goBack() (and the Android hardware back button) has
  // no previous screen to return to.
  React.useEffect(() => {
    if (!ready) return;
    return notificationService.addResponseListener((data) => {
      if (data?.storyId && navigationRef.current) {
        navigationRef.current.reset({
          index: 1,
          routes: [
            { name: 'Main' },
            { name: 'StoryDetail', params: { storyId: data.storyId } },
          ],
        });
      }
    });
  }, [ready]);

  return (
    <>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Main" component={AppNavigator} />
        <Stack.Screen name="StoryDetail" component={StoryDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Coins" component={CoinsScreen} />
        <Stack.Screen name="Video" component={VideoScreen} />
        {isNewUser ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        ) : null}
      </Stack.Navigator>
      <FloatingAudioPlayer />
    </>
  );
}

function Root({ navigationRef, ready }) {
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

  return user ? <MainStack isNewUser={false} navigationRef={navigationRef} ready={ready} /> : <AuthStack />;
}

export default function App() {
  const [fontsLoaded] = useFonts(FONT_MAP);
  const navigationRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);

  // Hold on the native splash until fonts are ready to avoid a text flash.
  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* KeyboardProvider feeds Android's native keyboard-animation frames to
            the KeyboardAvoider / KeyboardAwareScroll primitives — see
            src/components/ui/KeyboardAvoider.js for why RN's own
            KeyboardAvoidingView can't do the job under edge-to-edge.

            The three translucent flags are set explicitly because Expo (not
            react-native-edge-to-edge) owns edge-to-edge here, so the library
            can't auto-detect it. Left at their defaults it would re-apply its
            own top padding to mimic a non-edge-to-edge app, which would stack
            on top of the insets.top every screen already adds itself. */}
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
          <SafeAreaProvider>
            <ThemeProvider>
              <AppContextProvider>
                {/* Coins sit between the app state (which knows the signed-in
                    user) and the player (which plays paid episodes and pays
                    the finish reward). */}
                <WalletProvider>
                  <AudioProvider>
                    <NavigationContainer ref={navigationRef} onReady={() => setReady(true)}>
                      <StatusBar style="auto" />
                      <Root navigationRef={navigationRef} ready={ready} />
                    </NavigationContainer>
                  </AudioProvider>
                </WalletProvider>
              </AppContextProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
