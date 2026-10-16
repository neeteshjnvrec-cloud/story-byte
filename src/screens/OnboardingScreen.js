// Onboarding — the three welcome screens after signing up: listen (every
// genre, in 16 languages), watch (long episodes and Shorts, which play in
// the app) and create (an idea, written and narrated by AI, shared with the
// community). Swipe or tap Next; Skip jumps straight in. The artwork is
// real story art from the app (assets/onboarding), across genres.
import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Pressable, Image, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

const ART = {
  // Listen: one cover per genre, the adventure in front.
  devotional: require('../../assets/onboarding/durga.webp'),
  romance: require('../../assets/onboarding/library.webp'),
  adventure: require('../../assets/onboarding/palace.webp'),
  mystery: require('../../assets/onboarding/mystery.webp'),
  scifi: require('../../assets/onboarding/scifi.webp'),
  // Watch: Alien Is My Girlfriend, episode 3, and a romance Short.
  episode: require('../../assets/onboarding/alien-wide.webp'),
  short: require('../../assets/onboarding/romance-tall.webp'),
  // Create.
  forest: require('../../assets/onboarding/forest.webp'),
};
export const BRAND_MARK = require('../../assets/brand-mark.png');

const FAN = [
  { art: 'devotional', label: 'Devotional' },
  { art: 'romance', label: 'Romance' },
  { art: 'adventure', label: 'Adventure' },
  { art: 'mystery', label: 'Mystery' },
  { art: 'scifi', label: 'Sci-fi' },
];

const shadow = (o = 0.22, r = 18, y = 10) => ({
  shadowColor: '#2A2118', shadowOpacity: o, shadowRadius: r, shadowOffset: { width: 0, height: y }, elevation: Math.round(r / 2),
});

// --- artwork -----------------------------------------------------------------

/** Three equaliser bars, gently moving: something is playing. */
function Equalizer({ color }) {
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    const loops = bars.map((v, i) => Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 380 + i * 110, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.35, duration: 380 + i * 110, useNativeDriver: true }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars]);
  return (
    <View style={styles.eq}>
      {bars.map((v, i) => (
        <Animated.View key={i} style={[styles.eqBar, { backgroundColor: color, transform: [{ scaleY: v }] }]} />
      ))}
    </View>
  );
}

function ListenArt({ size, theme }) {
  const front = Math.round(size * 0.5);
  const side = Math.round(size * 0.36);
  // [left edge, top, rotation, z] for the five covers, outside in.
  const spots = [
    [0, 46, -14, 1], [size * 0.13, 22, -7, 2], [(size - front) / 2, 0, 0, 3],
    [size * 0.87 - side, 22, 7, 2], [size - side, 46, 14, 1],
  ];
  return (
    <View style={{ width: size, height: front + 92, alignItems: 'center' }}>
      {FAN.map((f, i) => {
        const [left, top, rot, z] = spots[i];
        const w = i === 2 ? front : side;
        return (
          <View key={f.art} style={[styles.fanCard, { left, top, width: w, height: w, zIndex: z, transform: [{ rotate: `${rot}deg` }] }, shadow(i === 2 ? 0.3 : 0.16, i === 2 ? 22 : 12, i === 2 ? 14 : 6)]}>
            <Image source={ART[f.art]} style={StyleSheet.absoluteFill} />
            {/* Only the front cover is wide enough to show its genre. */}
            {i === 2 ? <View style={styles.genreTag}><AppText variant="micro" style={styles.onDark}>{f.label}</AppText></View> : null}
          </View>
        );
      })}
      <View style={[styles.nowPlaying, { top: front + 14, backgroundColor: theme.surfaceElevated, borderColor: theme.border }, shadow(0.16, 14, 6)]}>
        <Image source={ART.adventure} style={styles.npThumb} />
        <View style={{ flexShrink: 1 }}>
          <AppText variant="micro" color="accent" style={{ letterSpacing: 1 }}>NOW PLAYING · HINDI</AppText>
          <AppText variant="label" numberOfLines={1}>यात्रा के रंग: जीवन में परिवर्तन</AppText>
        </View>
        <Equalizer color={theme.accent} />
      </View>
    </View>
  );
}

function WatchArt({ size, theme }) {
  const w = size;
  const h = Math.round((w * 9) / 16);
  const shortW = Math.round(size * 0.27);
  return (
    <View style={{ width: w, height: h + 64 }}>
      <View style={[styles.video, { width: w, height: h }, shadow(0.28, 22, 14)]}>
        <Image source={ART.episode} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={StyleSheet.absoluteFill} />
        <View style={styles.bigPlay}><Icon name="play" size={28} color={theme.accent} /></View>
        <View style={styles.videoMeta}>
          <AppText variant="micro" style={styles.onDarkMuted}>SCI-FI ROMANCE · EPISODE 3</AppText>
          <AppText variant="label" style={styles.onDark}>Alien Is My Girlfriend</AppText>
        </View>
        <View style={styles.duration}><AppText variant="micro" style={styles.onDark}>16 min</AppText></View>
      </View>
      <View style={[styles.short, { width: shortW, height: Math.round((shortW * 16) / 9), borderColor: theme.background }, shadow(0.3, 16, 10)]}>
        <Image source={ART.short} style={StyleSheet.absoluteFill} />
        <View style={styles.shortBadge}>
          <Icon name="play" size={9} color="#fff" />
          <AppText variant="micro" style={styles.onDark}>Shorts</AppText>
        </View>
      </View>
    </View>
  );
}

function CreateArt({ size, theme }) {
  const cover = Math.round(size * 0.36);
  return (
    <View style={{ width: size }}>
      <View style={[styles.idea, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }, shadow(0.12, 14, 6)]}>
        <View style={styles.row}>
          <Icon name="pencil" size={14} color={theme.accent} />
          <AppText variant="micro" color="accent" style={{ letterSpacing: 1 }}>YOUR IDEA</AppText>
        </View>
        <AppText variant="bodyL" style={{ marginTop: 6 }}>“Two friends follow a firefly into a forest no map shows…”</AppText>
      </View>

      <View style={styles.magic}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        <View style={[styles.magicPill, { backgroundColor: theme.accentSoft }]}>
          <Icon name="sparkles" size={14} color={theme.accent} />
          <AppText variant="caption" color="accent" style={{ fontWeight: '600' }}>AI writes it · narrates it</AppText>
        </View>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>

      <View style={[styles.result, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }, shadow(0.2, 18, 10)]}>
        <Image source={ART.forest} style={{ width: cover, height: cover, borderRadius: 16 }} />
        <View style={{ flex: 1, gap: 6 }}>
          <AppText variant="h2" numberOfLines={2}>The Hidden Forest</AppText>
          <AppText variant="caption" color="textSecondary">by you · 3 min</AppText>
          <View style={[styles.row, { marginTop: 4 }]}>
            <View style={[styles.miniPlay, { backgroundColor: theme.accent }]}><Icon name="play" size={12} color={theme.onAccent} /></View>
            <Equalizer color={theme.accent} />
          </View>
          <View style={[styles.row, styles.shared, { borderColor: theme.border }]}>
            <Icon name="people" size={13} color={theme.textSecondary} />
            <AppText variant="micro" color="textSecondary">Shared in Community</AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Draws `children` at its natural size, scaled down to fit `height`. */
function FitHeight({ height, children }) {
  const [natural, setNatural] = useState(0);
  const scale = natural > height ? height / natural : 1;
  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      <View onLayout={(e) => setNatural(e.nativeEvent.layout.height)} style={{ transform: [{ scale }] }}>
        {children}
      </View>
    </View>
  );
}

const SLIDES = [
  {
    key: 'listen',
    eyebrow: 'LISTEN',
    title: 'Stories worth\nlistening to',
    body: 'Romance, mystery, adventure, kids’ tales, devotional kathas and more — new every day, in 16 languages, and free.',
    chips: ['Every genre', '16 languages', 'Free'],
    Art: ListenArt,
  },
  {
    key: 'watch',
    eyebrow: 'WATCH',
    title: 'Full episodes,\nright in the app',
    body: 'Long video stories and Shorts play here — and keep playing in a small window while you browse.',
    Art: WatchArt,
  },
  {
    key: 'create',
    eyebrow: 'CREATE',
    title: 'Your idea,\nnarrated',
    body: 'Write one line. AI turns it into a story with a cover and a voice, and the community gets to hear it.',
    Art: CreateArt,
  },
];

// --- screen ------------------------------------------------------------------

export const OnboardingScreen = ({ onComplete }) => {
  const { theme } = useTheme() || { theme: {} };
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const pager = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const artSize = Math.min(width - 48, 380);
  // Small phones get tighter text, and the artwork whatever room is left —
  // the same on every screen, so the headings line up as you swipe.
  const compact = height < 720;
  const artHeight = Math.max(160, Math.min(340, height - insets.top - insets.bottom - (compact ? 345 : 470)));
  const isLast = index === SLIDES.length - 1;

  const finish = async () => {
    try {
      await AsyncStorage.setItem('storybyte-onboarding-complete', 'true');
    } catch (e) {
      // Silent fail
    }
    if (onComplete) onComplete();
    else navigation.replace('Login');
  };

  const goTo = (i) => {
    pager.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  const next = () => (isLast ? finish() : goTo(index + 1));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={[theme.accentSoft, theme.background]} style={styles.glow} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <View style={styles.brand}>
          <Image source={BRAND_MARK} style={styles.brandMark} resizeMode="contain" accessibilityIgnoresInvertColors />
          <AppText variant="h2" style={{ color: theme.text }}>
            Story<AppText variant="h2" color="accent">Byte</AppText>
          </AppText>
        </View>
        {!isLast ? (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip">
            <AppText variant="label" color="textSecondary">Skip</AppText>
          </Pressable>
        ) : null}
      </View>

      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {SLIDES.map(({ key, eyebrow, title, body, chips, Art }) => (
          <ScrollView
            key={key}
            style={{ width }}
            contentContainerStyle={styles.page}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.artArea}>
              <FitHeight height={artHeight}><Art size={artSize} theme={theme} /></FitHeight>
            </View>
            <View style={styles.copy}>
              <AppText variant="micro" color="accent" style={styles.eyebrow}>{eyebrow}</AppText>
              <AppText variant="displayM" style={[styles.title, compact && styles.titleCompact]}>{title}</AppText>
              <AppText variant={compact ? 'body' : 'bodyL'} color="textSecondary" style={[styles.body, compact && { marginTop: 8 }]}>{body}</AppText>
              {chips && !compact ? (
                <View style={styles.chips}>
                  {chips.map((c) => (
                    <View key={c} style={[styles.chip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                      <AppText variant="caption" color="textSecondary">{c}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
        ))}
      </Animated.ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => {
            const range = [(i - 1) * width, i * width, (i + 1) * width];
            return (
              <Pressable key={s.key} onPress={() => goTo(i)} hitSlop={8} accessibilityLabel={`Screen ${i + 1} of ${SLIDES.length}`}>
                <Animated.View
                  style={[styles.dot, {
                    width: scrollX.interpolate({ inputRange: range, outputRange: [8, 26, 8], extrapolate: 'clamp' }),
                    backgroundColor: theme.accent,
                    opacity: scrollX.interpolate({ inputRange: range, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' }),
                  }]}
                />
              </Pressable>
            );
          })}
        </View>
        <Button title={isLast ? 'Start listening' : 'Next'} onPress={next} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 6 },
  page: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12 },
  artArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  copy: { paddingHorizontal: 4 },
  eyebrow: { letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 32, lineHeight: 38 },
  titleCompact: { fontSize: 26, lineHeight: 31 },
  body: { marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  footer: { paddingHorizontal: 24, paddingTop: 10, gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  dot: { height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 42, height: 29 },
  fanCard: { position: 'absolute', borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  genreTag: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  nowPlaying: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 18, borderWidth: 1, maxWidth: '92%',
  },
  npThumb: { width: 38, height: 38, borderRadius: 10 },
  eq: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 18, marginLeft: 4 },
  eqBar: { width: 3, height: 18, borderRadius: 2 },

  video: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' },
  bigPlay: {
    position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -32,
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingLeft: 4,
  },
  videoMeta: { position: 'absolute', left: 16, bottom: 14, right: 90 },
  duration: { position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  onDark: { color: '#fff' },
  onDarkMuted: { color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  short: { position: 'absolute', right: 10, bottom: 0, borderRadius: 16, overflow: 'hidden', borderWidth: 3, transform: [{ rotate: '5deg' }] },
  shortBadge: {
    position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E62117', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },

  idea: { borderWidth: 1, borderRadius: 20, padding: 16 },
  magic: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  line: { flex: 1, height: 1 },
  magicPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  result: { flexDirection: 'row', gap: 14, borderWidth: 1, borderRadius: 22, padding: 12, alignItems: 'center' },
  miniPlay: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  shared: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
});

export default OnboardingScreen;
