// Sign in — story art up top (AuthLayout), then Google, then email and
// password, with "Forgot password?" by the password field.
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAppContext } from '../../context/AppContext';
import { AppText } from '../../components/ui/AppText';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { AuthLayout, GoogleButton, OrDivider, AuthFooterLink } from './AuthLayout';

export const LoginScreen = ({ navigation }) => {
  const { loginWithEmail } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const google = useGoogleAuth(setError);
  const passwordRef = useRef(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Please enter your email and password'); return; }
    try {
      setError(''); setSubmitting(true);
      await loginWithEmail(email.trim(), password);
    } catch (e) {
      setError(getAuthErrorMessage(e.code, 'login'));
    } finally { setSubmitting(false); }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to pick up your stories where you left off.">
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
});

export default LoginScreen;
