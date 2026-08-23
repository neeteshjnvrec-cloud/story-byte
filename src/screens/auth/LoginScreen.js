// Login — warm storybook auth. Parchment ground, gradient logo badge, serif.
import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { KeyboardAwareScroll } from '../../components/ui/KeyboardAvoider';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

export const LoginScreen = ({ navigation }) => {
  const { loginWithEmail } = useAppContext();
  const { theme } = useTheme() || { theme: {} };
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const google = useGoogleAuth(setError);

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
    <KeyboardAwareScroll
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 }]}
      showsVerticalScrollIndicator={false}
    >
        <View style={styles.center}>
          <LinearGradient colors={[theme.gradientStart, theme.gradientEnd]} style={styles.badge}>
            <Icon name="book" size={38} color="#fff" />
          </LinearGradient>
          <AppText variant="displayM">Welcome back</AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 4 }}>Sign in to continue your stories</AppText>
        </View>

        <View style={{ marginTop: 26 }}>
          <Input icon="mail" placeholder="you@email.com" value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Input icon="lock" placeholder="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" />

          {error ? <AppText variant="caption" color="error" style={{ marginBottom: 10, marginLeft: 2 }}>{error}</AppText> : null}

          <Button title="Sign in" onPress={handleLogin} loading={submitting} />

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot} hitSlop={8}>
            <AppText variant="label" color="accent" style={{ fontSize: 13 }}>Forgot password?</AppText>
          </Pressable>

          <View style={styles.orRow}>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
            <AppText variant="caption" color="textTertiary">or</AppText>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
          </View>

          <Button title="Continue with Google" variant="ghost" leftIcon="globe"
            loading={google.inProgress} onPress={google.signIn} />

          <View style={styles.footer}>
            <AppText variant="caption" color="textSecondary">New here? </AppText>
            <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8}>
              <AppText variant="label" color="accent" style={{ fontSize: 13 }}>Create an account</AppText>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScroll>
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
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28 },
  center: { alignItems: 'center' },
  badge: {
    width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#3C2814', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  forgot: { alignSelf: 'flex-end', marginTop: 12 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  line: { flex: 1, height: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
});

export default LoginScreen;
