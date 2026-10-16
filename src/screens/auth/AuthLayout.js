// The sign-in, sign-up and reset-password screens' shared frame: story art
// across the top (assets/onboarding) with the StoryByte name over it, and a
// rounded panel below it holding the title and the form. The whole page
// scrolls with the keyboard, so the fields are never hidden behind it.
import React from 'react';
import { View, Pressable, Image, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { KeyboardAwareScroll } from '../../components/ui/KeyboardAvoider';

export const AUTH_ART = {
  login: require('../../../assets/onboarding/hanuman-wide.jpg'),
  signup: require('../../../assets/onboarding/durga-wide.jpg'),
  reset: require('../../../assets/onboarding/palace-wide.jpg'),
};

export function AuthLayout({ art, title, subtitle, onBack, children }) {
  const { theme } = useTheme() || { theme: {} };
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroHeight = Math.max(170, Math.min(280, Math.round(height * 0.27))) + insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAwareScroll
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={{ height: heroHeight }}>
          <Image source={art} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {/* Keeps the status bar, back button and name readable on bright art. */}
          <LinearGradient colors={['rgba(20,12,6,0.6)', 'rgba(20,12,6,0)']} style={[styles.topShade, { height: insets.top + 110 }]} />
          <View style={[styles.heroTop, { paddingTop: insets.top + 10 }]}>
            {onBack ? (
              <Pressable onPress={onBack} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
                <Icon name="chev-left" size={22} color="#fff" />
              </Pressable>
            ) : null}
            <AppText variant="h2" style={styles.wordmark}>
              Story<AppText variant="h2" style={[styles.wordmark, { color: '#F6B989' }]}>Byte</AppText>
            </AppText>
          </View>
        </View>

        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 24 }]}>
          <AppText variant="displayM">{title}</AppText>
          {subtitle ? <AppText variant="body" color="textSecondary" style={{ marginTop: 6 }}>{subtitle}</AppText> : null}
          <View style={{ marginTop: 22 }}>{children}</View>
        </View>
      </KeyboardAwareScroll>
    </View>
  );
}

/** Google's "G", in its own colours (Google's sign-in branding guidelines). */
function GoogleG({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export function GoogleButton({ onPress, loading }) {
  const { theme, isDark } = useTheme() || { theme: {} };
  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      style={({ pressed }) => [
        styles.google,
        { backgroundColor: isDark ? theme.surfaceElevated : '#FFFFFF', borderColor: theme.border },
        pressed && { opacity: 0.9 },
      ]}
    >
      {loading ? <ActivityIndicator color={theme.accent} /> : (
        <>
          <GoogleG />
          <AppText variant="label" style={{ fontSize: 15 }}>Continue with Google</AppText>
        </>
      )}
    </Pressable>
  );
}

/** "──── or with email ────" */
export function OrDivider({ label = 'or with email' }) {
  const { theme } = useTheme() || { theme: {} };
  return (
    <View style={styles.or}>
      <View style={[styles.orLine, { backgroundColor: theme.border }]} />
      <AppText variant="caption" color="textTertiary">{label}</AppText>
      <View style={[styles.orLine, { backgroundColor: theme.border }]} />
    </View>
  );
}

/** "New here? Create an account" — a line of text with a link at the end. */
export function AuthFooterLink({ text, link, onPress }) {
  return (
    <View style={styles.footer}>
      <AppText variant="body" color="textSecondary">{text} </AppText>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
        <AppText variant="label" color="accent" style={{ fontSize: 15 }}>{link}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  wordmark: { color: '#fff', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  sheet: { flexGrow: 1, marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 28 },
  google: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderRadius: 15, borderWidth: 1, paddingVertical: 14, minHeight: 52,
  },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  orLine: { flex: 1, height: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 22 },
});
