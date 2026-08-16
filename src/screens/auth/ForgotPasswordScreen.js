// Forgot password — matches the warm auth design.
// Step 1: user enters email → we send a reset link (not a password) to the
// registered address. Step 2: they open the link, enter the code, and set a
// new password. This file only handles step 1.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { sendPasswordResetEmail } from '../../services/firebase';

export const ForgotPasswordScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) { setError('Please enter your email address'); return; }
    try {
      setError(''); setSubmitting(true);
      // Send a reset link to the registered email. handleCodeInApp lets the
      // link land on our ResetPassword screen with the oobCode embedded.
      await sendPasswordResetEmail(auth, email.trim(), {
        url: 'https://storybyte-76716.firebaseapp.com/auth/reset-password',
        handleCodeInApp: true
      });
      Alert.alert('Check your inbox', "We've sent a reset link to your email. Enter the code on the next screen.",
        [{ text: 'OK', onPress: () => navigation.navigate('ResetPassword', { email: email.trim() }) }]);
    } catch (e) {
      let msg = 'Failed to send reset email. Please try again.';
      if (e.code === 'auth/user-not-found') msg = 'No account found with this email';
      else if (e.code === 'auth/invalid-email') msg = 'Please enter a valid email address';
      else if (e.code === 'auth/missing-continue-uri') msg = 'Reset link not configured. Please try again later';
      setError(msg);
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
            <Icon name="lock" size={34} color="#fff" />
          </LinearGradient>
          <AppText variant="displayM">Reset password</AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 4, textAlign: 'center' }}>
            Enter your email and we'll send a reset link.
          </AppText>
        </View>

        <View style={{ marginTop: 24 }}>
          <Input icon="mail" placeholder="you@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          {error ? <AppText variant="caption" color="error" style={{ marginBottom: 10, marginLeft: 2 }}>{error}</AppText> : null}
          <Button title="Send reset link" onPress={handleReset} loading={submitting} />
          <Pressable onPress={() => navigation.navigate('Login')} style={styles.back} hitSlop={8}>
            <AppText variant="label" color="accent" style={{ fontSize: 13 }}>Back to sign in</AppText>
          </Pressable>
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
  back: { alignSelf: 'center', marginTop: 18 },
});

export default ForgotPasswordScreen;