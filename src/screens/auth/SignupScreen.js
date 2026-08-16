// Signup — matches the warm auth design.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { getAuthErrorMessage } from './LoginScreen';

export const SignupScreen = ({ navigation }) => {
  const { signupWithEmail } = useAppContext();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignup = async () => {
    if (!displayName.trim()) return setError('Please enter your name');
    if (!email.trim()) return setError('Please enter your email');
    if (password.length < 6) return setError('Password should be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');
    try {
      setError(''); setSubmitting(true);
      await signupWithEmail(email.trim(), password, displayName.trim());
    } catch (e) {
      setError(getAuthErrorMessage(e.code, 'signup'));
    } finally { setSubmitting(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={10}><Icon name="chev-left" /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.center}>
          <LinearGradient colors={[theme.gradientStart, theme.gradientEnd]} style={styles.badge}>
            <Icon name="book" size={38} color="#fff" />
          </LinearGradient>
          <AppText variant="displayM">Create your account</AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 4 }}>Free forever · no card needed</AppText>
        </View>

        <View style={{ marginTop: 24 }}>
          <Input icon="user" placeholder="Your name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
          <Input icon="mail" placeholder="you@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Input icon="lock" placeholder="Choose a password (min 6)" value={password} onChangeText={setPassword} secure autoCapitalize="none" />
          <Input icon="lock" placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secure autoCapitalize="none" />

          {error ? <AppText variant="caption" color="error" style={{ marginBottom: 10, marginLeft: 2 }}>{error}</AppText> : null}

          <Button title="Create account" onPress={handleSignup} loading={submitting} />

          <View style={styles.footer}>
            <AppText variant="caption" color="textSecondary">Already have an account? </AppText>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
              <AppText variant="label" color="accent" style={{ fontSize: 13 }}>Sign in</AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingBottom: 4 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
  center: { alignItems: 'center' },
  badge: {
    width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#3C2814', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
});

export default SignupScreen;
