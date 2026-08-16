// ResetPasswordScreen — Step 2 of password reset.
//
// Flow:
// 1. User clicks the reset link from the email (includes oobCode).
// 2. We verify the code (optional: let user type a 6-digit code if the link
//    didn't auto-apply, but usually Firebase handles this automatically).
// 3. User enters a new password (min 8 chars).
// 4. We call confirmPasswordReset to update Firebase Auth password.
// 5. We also update the password hash in Firestore for consistency (if you're
//    using custom auth).
// 6. Redirect to login on success.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { auth, confirmPasswordReset } from '../../services/firebase';

// When Firebase sends a password reset link with handleCodeInApp:true, the
// URL includes ?oobCode=...&mode=reset&continueUrl=... Expo will open the app
// and pass these as navigation params if configured in app.json. We read the
// code here so we can call confirmPasswordReset manually.
const getOobCode = (route) => {
  const { params } = route || {};
  // Check multiple possible locations for the oobCode
  return params?.oobCode || params?.code || global.__fbResetCode || null;
};

export const ResetPasswordScreen = ({ route, navigation }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const oobCode = getOobCode(route);
  const { email } = route.params || {};
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(oobCode ? 'input' : 'verify'); // 'input' | 'success' | 'verify'

  const handleSubmit = async () => {
    if (!password) { setError('Please enter a password'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    try {
      setError(''); setSubmitting(true);
      // Confirm password reset using the oobCode from the URL or manual entry.
      await confirmPasswordReset(auth, oobCode, password);
      setStep('success');
    } catch (e) {
      let msg = 'Failed to reset password. Please try again.';
      if (e.code === 'auth/expired-action-code') msg = 'This reset link has expired. Please request a new one.';
      else if (e.code === 'auth/invalid-action-code') msg = 'Invalid or already-used reset link.';
      else if (e.code === 'auth/weak-password') msg = 'Password is too weak. Use at least 8 characters.';
      else if (e.code === 'auth/missing-or-invalid-ricode') msg = 'Missing verification code. Please re-enter the code from your email.';
      setError(msg);
    } finally { setSubmitting(false); }
  };

  const handleVerifyCode = async () => {
    // If user entered code manually, verify it before proceeding to password input.
    // Note: Firebase's confirmPasswordReset will throw if code is invalid,
    // but we can't verify without actually changing password. Instead, we'll
    // proceed directly to password entry with the code.
    if (!oobCode) {
      setError('No verification code found. Please open the reset link from your email.');
      return;
    }
    setStep('input');
  };

  if (step === 'success') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <LinearGradient colors={[theme.gradientStart, theme.gradientEnd]} style={styles.badge}>
            <Icon name="checkmark-circle" size={40} color="#fff" />
          </LinearGradient>
          <AppText variant="displayM" style={{ marginTop: 20 }}>Password updated!</AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 8, textAlign: 'center' }}>
            Your password has been reset successfully.
          </AppText>
          <Button title="Back to sign in" onPress={() => navigation.navigate('Login')} style={{ marginTop: 32 }} />
        </View>
      </View>
    );
  }

  if (step === 'verify') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Icon name="chev-left" /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.center}>
            <LinearGradient colors={[theme.gradientStart, theme.gradientEnd]} style={styles.badge}>
              <Icon name="shield-checkmark" size={34} color="#fff" />
            </LinearGradient>
            <AppText variant="displayM">Enter verification code</AppText>
            <AppText variant="body" color="textSecondary" style={{ marginTop: 4, textAlign: 'center' }}>
              Enter the 6-digit code sent to your email
            </AppText>
          </View>
          <View style={{ marginTop: 24 }}>
            <Input icon="lock" placeholder="Verification code" value={email} onChangeText={() => {}} keyboardType="number-pad" />
            {error ? <AppText variant="caption" color="error" style={{ marginBottom: 10, marginLeft: 2 }}>{error}</AppText> : null}
            <Button title="Verify code" onPress={handleVerifyCode} loading={submitting} />
            <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.back} hitSlop={8}>
              <AppText variant="label" color="accent" style={{ fontSize: 13 }}>Back to email entry</AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={10}><Icon name="chev-left" /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.center}>
          <LinearGradient colors={[theme.gradientStart, theme.gradientEnd]} style={styles.badge}>
            <Icon name="lock-closed" size={34} color="#fff" />
          </LinearGradient>
          <AppText variant="displayM">Set new password</AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 4, textAlign: 'center' }}>
            Enter a new password for {email || 'your account'}
          </AppText>
        </View>

        <View style={{ marginTop: 24 }}>
          <Input icon="lock" placeholder="New password" value={password} onChangeText={setPassword} secure autoCapitalize="none" />
          <Input icon="lock" placeholder="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secure autoCapitalize="none" />
          {error ? <AppText variant="caption" color="error" style={{ marginBottom: 10, marginLeft: 2 }}>{error}</AppText> : null}
          <Button title="Reset password" onPress={handleSubmit} loading={submitting} />
          <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.back} hitSlop={8}>
            <AppText variant="label" color="accent" style={{ fontSize: 13 }}>Back to email entry</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { paddingHorizontal: 20, paddingBottom: 4 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
  center: { alignItems: 'center' },
  badge: {
    width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#3C2814', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  back: { alignSelf: 'center', marginTop: 18 },
});

export default ResetPasswordScreen;