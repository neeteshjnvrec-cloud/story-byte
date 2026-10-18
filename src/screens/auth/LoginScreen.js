// Sign in — story art up top (AuthLayout), then Google, then email and
// password, with "Forgot password?" by the password field.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAppContext } from '../../context/AppContext';
import { AppText } from '../../components/ui/AppText';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { AuthLayout, GoogleButton, OrDivider, AuthFooterLink } from './AuthLayout';

export const LoginScreen = ({ navigation, route }) => {
  const { loginWithEmail, guest, continueAsGuest } = useAppContext();
  const [email, setEmail] = useState(route?.params?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const google = useGoogleAuth(setError);
  const passwordRef = useRef(null);

  // Sent here from sign up with an email that already has an account.
  useEffect(() => {
    if (!route?.params?.email) return;
    setEmail(route.params.email);
    setError('');
    passwordRef.current?.focus();
  }, [route?.params?.email]);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Please enter your email and password'); return; }
    try {
      setError(''); setSubmitting(true);
      await loginWithEmail(email.trim(), password);
    } catch (e) {
      setError(getAuthErrorMessage(e.code, 'login'));
    } finally { setSubmitting(false); }
  };

  // Opened from a guest's "Sign in" prompt there's a screen to return to, and
  // leaving goes back to it; as the first screen (signed out), leaving means
  // continuing as a guest. Decided by the stack, not the guest flag alone:
  // going back with nothing behind this screen is an unhandled GO_BACK.
  const openedOverApp = guest && navigation.canGoBack();
  const leave = () => (navigation.canGoBack() ? navigation.goBack() : continueAsGuest());

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to pick up your stories where you left off."
      onBack={openedOverApp ? leave : undefined}>
      <GoogleButton onPress={google.signIn} loading={google.inProgress} />
      <OrDivider />

      <Input label="Email" icon="mail" placeholder="you@email.com" value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"
        textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
      <Input label="Password" icon="lock" placeholder="Your password" value={password} onChangeText={setPassword}
        secure autoCapitalize="none" autoComplete="current-password" textContentType="password"
        ref={passwordRef} returnKeyType="go" onSubmitEditing={handleLogin} />

      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot} hitSlop={8} accessibilityRole="link">
        <AppText variant="label" color="accent" style={{ fontSize: 13 }}>Forgot password?</AppText>
      </Pressable>

      {error ? <AppText variant="caption" color="error" style={styles.error}>{error}</AppText> : null}

      <Button title="Sign in" onPress={handleLogin} loading={submitting} />

      <AuthFooterLink text="New to StoryByte?" link="Create an account" onPress={() => navigation.navigate('Signup')} />

      {/* Listening needs no account. A guest who opened this from a "Sign in"
          prompt just goes back to where they were. */}
      <Pressable onPress={leave} style={styles.guest} hitSlop={8} accessibilityRole="button">
        <AppText variant="label" color="textSecondary" style={{ fontSize: 14 }}>
          {openedOverApp ? 'Not now' : 'Continue without account'}
        </AppText>
      </Pressable>
    </AuthLayout>
  );
};

export function getAuthErrorMessage(code, action = 'login') {
  switch (code) {
    case 'auth/invalid-email': return 'Please enter a valid email address';
    case 'auth/user-not-found': return 'No account found with this email';
    case 'auth/wrong-password': return 'Incorrect password. Please try again';
    case 'auth/invalid-credential': return 'Incorrect email or password';
    case 'auth/user-disabled': return 'This account has been disabled';
    case 'auth/email-already-in-use': return 'An account with this email already exists';
    case 'auth/weak-password': return 'Password should be at least 6 characters';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later';
    case 'auth/network-request-failed': return 'Network error. Please check your connection';
    default: return action === 'signup' ? 'Signup failed. Please try again' : 'Login failed. Please try again';
  }
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 16 },
  error: { marginBottom: 12, marginLeft: 2 },
  guest: { alignSelf: 'center', marginTop: 18, paddingVertical: 6 },
});

export default LoginScreen;
