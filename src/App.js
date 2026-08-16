import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  ActivityIndicator,
  Text,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { auth, onAuthStateChanged } from './services/firebase';
import { HomeScreen } from './screens/HomeScreen';
import { StoryDetailScreen } from './screens/StoryDetailScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { LoginScreen } from './screens/auth/LoginScreen';
import { SignupScreen } from './screens/auth/SignupScreen';
import { ForgotPasswordScreen } from './screens/auth/ForgotPasswordScreen';
import { AudioProvider } from './context/AudioContext';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { AppContextProvider } from './context/AppContext';
import { FloatingAudioPlayer } from './components/FloatingAudioPlayer';
import { AppNavigator } from './navigation/AppNavigator';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

// Hook that safely reads theme from context if available, else falls back
function useThemeSafe() {
  try {
    return useTheme();
  } catch (e) {
    // Fallback if no ThemeProvider — shouldn't happen
    return {
      theme: { accent: '#667eea', card: '#1e1e1e', border: '#2a2a2a' },
      isDark: true,
    };
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </SafeAreaView>
    );
  }

  return (
    <ThemeProvider>
      <AppContextProvider>
        <AudioProvider>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {user ? (
                <>
                  <Stack.Screen name="Main" component={AppNavigator} />
                  <Stack.Screen
                    name="StoryDetail"
                    component={StoryDetailScreen}
                    options={{ presentation: 'modal' }}
                  />
                </>
              ) : (
                <Stack.Screen name="Auth" component={AuthStack} />
              )}
            </Stack.Navigator>
            <FloatingAudioPlayer />
          </NavigationContainer>
          <StatusBar style={useThemeSafe().isDark ? 'light' : 'dark'} />
        </AudioProvider>
      </AppContextProvider>
    </ThemeProvider>
  );
}
