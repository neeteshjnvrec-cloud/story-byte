// Forgot password — the sign-in screen's design (AuthLayout). Step 1: the
// user enters their email and we send a reset link (not a password) to it.
// Step 2: they open the link and set a new password on Firebase's page.
// Once the link is sent, this screen says so and where to look, instead of
// a pop-up, and can send it again.
import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useAppContext } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthLayout, AUTH_ART } from './AuthLayout';

export const ForgotPasswordScreen = ({ navigation }) => {
  const { resetPassword } = useAppContext();
  const { theme } = useTheme() || { theme: {} };
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState(null);

  const handleReset = async () => {
    if (!email.trim()) { setError('Please enter your email address'); return; }
    try {
      setError(''); setSubmitting(true);
      await resetPassword(email.trim());
      setSentTo(email.trim());
    } catch (e) {
      let msg = e.message || 'Failed to send reset link. Please try again.';
      if (e.code === 'auth/invalid-email') msg = 'Please enter a valid email address';
      else if (e.code === 'auth/user-not-found') msg = 'No account found with this email';
      else if (e.code === 'auth/too-many-requests') msg = 'Too many attempts. Please try again later';
      setError(msg);
    } finally { setSubmitting(false); }
  };

  if (sentTo) {
    return (
      <AuthLayout art={AUTH_ART.reset} title="Check your inbox" onBack={() => navigation.navigate('Login')}>
        <View style={[styles.sent, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.sentIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="mail" size={26} color={theme.accent} />
          </View>
          <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            We sent a reset link to
          </AppText>
          <AppText variant="h3" style={{ textAlign: 'center', marginTop: 2 }}>{sentTo}</AppText>
          <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: 10 }}>
            Open it to choose a new password. Not there in a minute? Check your spam folder.
          </AppText>
        </View>
        <Button title="Back to sign in" onPress={() => navigation.navigate('Login')} style={{ marginTop: 20 }} />
        {error ? <AppText variant="caption" color="error" style={styles.error}>{error}</AppText> : null}
        <Pressable onPress={handleReset} disabled={submitting} style={styles.link} hitSlop={8} accessibilityRole="button">
          <AppText variant="label" color="accent" style={{ fontSize: 14 }}>{submitting ? 'Sending…' : 'Send the link again'}</AppText>
        </Pressable>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      art={AUTH_ART.reset}
      title="Forgot your password?"
      subtitle="No problem. Enter your account's email and we'll send you a link to set a new one."
      onBack={() => navigation.navigate('Login')}
    >
      <Input label="Email" icon="mail" placeholder="you@email.com" value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
        returnKeyType="send" onSubmitEditing={handleReset} />
      {error ? <AppText variant="caption" color="error" style={styles.error}>{error}</AppText> : null}
      <Button title="Send reset link" onPress={handleReset} loading={submitting} style={{ marginTop: 4 }} />
      <Pressable onPress={() => navigation.navigate('Login')} style={styles.link} hitSlop={8} accessibilityRole="link">
        <AppText variant="label" color="accent" style={{ fontSize: 14 }}>Back to sign in</AppText>
      </Pressable>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  sent: { alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: 20 },
  sentIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  error: { marginTop: 12, marginLeft: 2 },
  link: { alignSelf: 'center', marginTop: 18 },
});

export default ForgotPasswordScreen;
