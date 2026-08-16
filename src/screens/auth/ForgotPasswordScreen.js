// Forgot password — matches the warm auth design.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export const ForgotPasswordScreen = ({ navigation }) => {
  const { resetPassword } = useAppContext();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) { setError('Please enter your email address'); return; }
    try {
      setError(''); setSubmitting(true);
      await resetPassword(email.trim());
      Alert.alert('Check your inbox', "We've sent a link to reset your password.",
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]);
    } catch (e) {
      let msg = 'Failed to send reset email. Please try again.';
      if (e.code === 'auth/user-not-found') msg = 'No account found with this email';
      else if (e.code === 'auth/invalid-email') msg = 'Please enter a valid email address';
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
            Enter your email and we'll send you a reset link.
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
