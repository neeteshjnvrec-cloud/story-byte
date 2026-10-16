// Sign up — the sign-in screen's design (AuthLayout): Google first, or a
// name, email and password.
import React, { useRef, useState } from 'react';
import { View, Linking, StyleSheet } from 'react-native';
import { useAppContext } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { getAuthErrorMessage } from './LoginScreen';
import { AuthLayout, AUTH_ART, GoogleButton, OrDivider, AuthFooterLink } from './AuthLayout';

const PRIVACY_URL = 'https://storybyte-76716.web.app/privacy.html';
const PERKS = [
  { icon: 'headphones', label: 'Daily katha' },
  { icon: 'globe', label: '16 languages' },
  { icon: 'sparkles', label: 'Create stories' },
];

export const SignupScreen = ({ navigation }) => {
  const { signupWithEmail } = useAppContext();
  const { theme } = useTheme() || { theme: {} };
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const google = useGoogleAuth(setError);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const handleSignup = async () => {
    if (!displayName.trim()) return setError('Please enter your name');
    if (!email.trim()) return setError('Please enter your email');
    if (password.length < 6) return setError('Password should be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');
    try {
      setError(''); setSubmitting(true);
      await signupWithEmail(email.trim(), password, displayName.trim());
      // Navigate to profile setup after successful signup
      navigation.navigate('ProfileSetup');
    } catch (e) {
      setError(getAuthErrorMessage(e.code, 'signup'));
    } finally { setSubmitting(false); }
  };

  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;

  return (
    <AuthLayout
      art={AUTH_ART.signup}
      title="Create your account"
      subtitle="Free forever · no card needed"
      onBack={() => navigation.navigate('Login')}
    >
      <View style={[styles.perks, { backgroundColor: theme.accentSoft }]}>
        {PERKS.map((p) => (
          <View key={p.label} style={styles.perk}>
            <Icon name={p.icon} size={18} color={theme.accent} />
            <AppText variant="caption" color="accent" numberOfLines={1} style={{ fontWeight: '600' }}>{p.label}</AppText>
          </View>
        ))}
      </View>

      <GoogleButton onPress={google.signIn} loading={google.inProgress} />
      <OrDivider />

      <Input label="Your name" icon="user" placeholder="What should we call you?" value={displayName} onChangeText={setDisplayName}
        autoCapitalize="words" autoComplete="name" textContentType="name"
        returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
      <Input label="Email" icon="mail" placeholder="you@email.com" value={email} onChangeText={setEmail} ref={emailRef}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
        returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
      <Input label="Password" icon="lock" placeholder="At least 6 characters" value={password} onChangeText={setPassword} ref={passwordRef}
        secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword"
        returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} />
      <Input label="Confirm password" icon="lock" placeholder="Type it again" value={confirmPassword} onChangeText={setConfirmPassword} ref={confirmRef}
        secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword"
        returnKeyType="go" onSubmitEditing={handleSignup} />
      {mismatch ? <AppText variant="caption" color="error" style={styles.hint}>Passwords don't match yet</AppText> : null}

      {error ? <AppText variant="caption" color="error" style={styles.error}>{error}</AppText> : null}

      <Button title="Create account" onPress={handleSignup} loading={submitting} style={{ marginTop: 4 }} />

      <AppText variant="caption" color="textTertiary" style={styles.legal}>
        By continuing you agree to our{' '}
        <AppText variant="caption" color="accent" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} style={{ fontWeight: '600' }}>
          Privacy Policy
        </AppText>.
      </AppText>

      <AuthFooterLink text="Already have an account?" link="Sign in" onPress={() => navigation.navigate('Login')} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  perks: { flexDirection: 'row', borderRadius: 16, paddingVertical: 12, marginTop: -6, marginBottom: 18 },
  perk: { flex: 1, alignItems: 'center', gap: 4 },
  hint: { marginTop: -8, marginBottom: 12, marginLeft: 2 },
  error: { marginBottom: 12, marginLeft: 2 },
  legal: { textAlign: 'center', marginTop: 14 },
});

export default SignupScreen;
