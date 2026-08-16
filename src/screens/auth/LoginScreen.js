// Login Screen for Story Byte
// Visual parity to story-teller/storybyte-fe/src/screens/LoginScreen.tsx + premium-styles.ts
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { authStyles } from './authStyles';

export const LoginScreen = ({ navigation }) => {
  const { loginWithEmail } = useAppContext();
  const { theme } = useTheme();

  // Theme-aware gradient colors
  const gradientColors = [theme.gradientStart, theme.gradientEnd];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      await loginWithEmail(email.trim(), password);
      // Auth state listener in AppContext will update the user and
      // App.js will switch to the main navigator automatically.
    } catch (e) {
      setError(getAuthErrorMessage(e.code, 'login'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[authStyles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Gradient background for glassy depth */}
      <LinearGradient
        colors={gradientColors}
        style={{ flex: 1, justifyContent: 'center', padding: 24 }}
      >
        {/* Glass logo */}
        <TouchableOpacity style={authStyles.logoCircle}>
          <Text style={authStyles.logoEmoji}>📚</Text>
        </TouchableOpacity>

        <Text style={authStyles.title}>Welcome Back</Text>
        <Text style={authStyles.subtitle}>
          Sign in to continue your stories
        </Text>

        {/* Email input (glass) */}
        <TextInput
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            authStyles.inputWrapper,
            {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: theme.text,
            },
          ]}
        />

        {/* Password input (glass + show/hide) */}
        <View style={[
          authStyles.inputWrapper,
          {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
        ]}>
          <TextInput
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            style={{
              flex: 1,
              fontSize: 16,
              color: theme.text,
              padding: 12,
            }}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ padding: 8 }}
          >
            <Text style={{ fontSize: 18 }}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

        {/* Primary CTA */}
        <TouchableOpacity
          style={[
            authStyles.primaryButton,
            { backgroundColor: theme.accent },
            submitting && { opacity: 0.7 },
          ]}
          onPress={handleLogin}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={authStyles.primaryButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Forgot link */}
        <TouchableOpacity
          style={authStyles.forgotLink}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={[authStyles.forgotLinkText, { color: theme.accent }]}>
            Forgot Password?
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={authStyles.divider}>
          <View
            style={[
              authStyles.dividerLine,
              {
                backgroundColor: theme.divider,
              },
            ]}
          />
          <Text style={[authStyles.dividerText, { color: theme.textSecondary }]}>
            or
          </Text>
          <View
            style={[
              authStyles.dividerLine,
              {
                backgroundColor: theme.divider,
              },
            ]}
          />
        </View>

        {/* Secondary / navigation */}
        <TouchableOpacity
          style={[
            authStyles.secondaryButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={[authStyles.secondaryButtonText, { color: theme.text }]}>
            Create New Account
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

// Map Firebase auth error codes to user-friendly messages
export function getAuthErrorMessage(code, action = 'login') {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again';
    case 'auth/invalid-credential':
      return 'Incorrect email or password';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection';
    default:
      return action === 'signup'
        ? 'Signup failed. Please try again'
        : 'Login failed. Please try again';
  }
}
