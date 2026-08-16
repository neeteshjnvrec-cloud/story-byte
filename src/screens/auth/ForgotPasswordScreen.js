// Forgot Password Screen for Story Byte
// Visual parity to legacy premium-styles.ts
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { authStyles } from './authStyles';

export const ForgotPasswordScreen = ({ navigation }) => {
  const { resetPassword } = useAppContext();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const gradientColors = [theme.gradientStart, theme.gradientEnd];

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      await resetPassword(email.trim());
      Alert.alert(
        'Password Reset Email Sent',
        'Check your inbox for a link to reset your password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (e) {
      let msg = 'Failed to send reset email. Please try again.';
      if (e.code === 'auth/user-not-found') {
        msg = 'No account found with this email';
      } else if (e.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[authStyles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={gradientColors}
        style={{ flex: 1, justifyContent: 'center', padding: 24 }}
      >
        <TouchableOpacity style={authStyles.logoCircle}>
          <Text style={authStyles.logoEmoji}>🔑</Text>
        </TouchableOpacity>

        <Text style={authStyles.title}>Reset Password</Text>
        <Text style={authStyles.subtitle}>
          Enter your email and we'll send you a reset link
        </Text>

        <TextInput
          style={[
            authStyles.inputWrapper,
            {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: theme.text,
            },
          ]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            authStyles.primaryButton,
            { backgroundColor: theme.accent },
            submitting && { opacity: 0.7 },
          ]}
          onPress={handleReset}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={authStyles.primaryButtonText}>Send Reset Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={authStyles.linkButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[authStyles.linkText, { color: theme.accent }]}>
            ← Back to Login
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};
