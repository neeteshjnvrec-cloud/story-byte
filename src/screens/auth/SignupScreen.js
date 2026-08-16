// Signup Screen for Story Byte
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { authStyles } from './authStyles';
import { getAuthErrorMessage } from './LoginScreen';

export const SignupScreen = ({ navigation }) => {
  const { signupWithEmail } = useAppContext();
  const { theme } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const gradientColors = [theme.gradientStart, theme.gradientEnd];

  const handleSignup = async () => {
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      await signupWithEmail(email.trim(), password, displayName.trim());
      // Auth listener flips to the main navigator automatically.
    } catch (e) {
      setError(getAuthErrorMessage(e.code, 'signup'));
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
          <Text style={authStyles.logoEmoji}>📚</Text>
        </TouchableOpacity>

        <Text style={authStyles.title}>Create Account</Text>
        <Text style={authStyles.subtitle}>
          Start your storytelling journey
        </Text>

        {[{
          value: displayName, onChangeText: setDisplayName, placeholder: 'Your name', secure: false
        }, {
          value: email, onChangeText: setEmail, placeholder: 'Email', secure: false
        }, {
          value: password, onChangeText: setPassword, placeholder: 'Password (min 6 characters)', secure: true
        }, {
          value: confirmPassword, onChangeText: setConfirmPassword, placeholder: 'Confirm password', secure: true
        }].map((field, i) => (
          <TextInput
            key={i}
            style={[
              authStyles.inputWrapper,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: theme.text,
              },
            ]}
            placeholder={field.placeholder}
            placeholderTextColor={theme.textSecondary}
            value={field.value}
            onChangeText={field.onChangeText}
            secureTextEntry={field.secure}
            keyboardType={field.placeholder === 'Email' ? 'email-address' : 'default'}
            autoCapitalize="none"
            autoCorrect={false}
          />
        ))}

        {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            authStyles.primaryButton,
            { backgroundColor: theme.accent },
            submitting && { opacity: 0.7 },
          ]}
          onPress={handleSignup}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={authStyles.primaryButtonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={authStyles.linkButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[authStyles.linkText, { color: theme.accent }]}>
            Already have an account? Sign In
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};
