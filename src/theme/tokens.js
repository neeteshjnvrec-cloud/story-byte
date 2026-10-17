// StoryByte design tokens — the single source for non-color scales.
// Colors live in useTheme.js (per-palette); everything else lives here.
// Screens/components read these via `useTheme()` (which re-exposes them) or by
// importing directly from this file.

// --- Fonts -----------------------------------------------------------------
// Family strings match the keys loaded by expo-font in App.js (see FONT_MAP).
export const FONTS = {
  // Warm serif display voice (storybook identity), sans for body/UI.
  display: 'Fraunces_700Bold',
  displaySemi: 'Fraunces_600SemiBold',
  heading: 'Fraunces_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  // Devanagari (Hindi) — routed by content language.
  devBody: 'NotoSansDevanagari_400Regular',
  devSemi: 'NotoSansDevanagari_600SemiBold',
};

// The map passed to useFonts() in App.js. Only the faces FONTS uses: every
// font listed here ships inside the app (Baloo for a kids face and Sora
// were bundled but never used, ~1 MB).
export const FONT_MAP = {
  Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf'),
  Fraunces_700Bold: require('@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf'),
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  NotoSansDevanagari_400Regular: require('@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf'),
  NotoSansDevanagari_600SemiBold: require('@expo-google-fonts/noto-sans-devanagari/600SemiBold/NotoSansDevanagari_600SemiBold.ttf'),
};

// --- Type ramp -------------------------------------------------------------
// { size, lineHeight, fontFamily, letterSpacing? }
export const type = {
  displayL: { fontSize: 34, lineHeight: 40, fontFamily: FONTS.display },
  displayM: { fontSize: 28, lineHeight: 34, fontFamily: FONTS.display },
  h1: { fontSize: 24, lineHeight: 30, fontFamily: FONTS.heading },
  h2: { fontSize: 20, lineHeight: 26, fontFamily: FONTS.heading },
  h3: { fontSize: 17, lineHeight: 24, fontFamily: FONTS.bodySemi },
  bodyL: { fontSize: 16, lineHeight: 26, fontFamily: FONTS.body },
  body: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.body },
  // Body size at semibold weight — for names and titles that sit next to body
  // copy and must read as distinct from it. Screens already asked for
  // variant="bodySemi"; without an entry here AppText fell back to `body`, so
  // publisher names rendered identically to the story text beside them.
  bodySemi: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.bodySemi },
  label: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.bodySemi },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: FONTS.bodySemi, letterSpacing: 0.3 },
};

// --- Spacing (4pt grid) ----------------------------------------------------
export const spacing = {
  xxs: 2, xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48, huge: 64,
};

// --- Radius ----------------------------------------------------------------
export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999,
};

// --- Elevation (shadow presets; components pick per palette) ---------------
export const elevation = {
  none: {},
  sm: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  md: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
  },
  lg: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },
};

// --- Motion (durations ms + easings; scaled globally for reduce-motion) ----
export const motion = {
  duration: { instant: 100, fast: 180, base: 250, slow: 400, slower: 800 },
  spring: { damping: 20, stiffness: 200, mass: 1 },
  springBouncy: { damping: 12, stiffness: 180, mass: 1 },
};

// Touch-target minimums per mode.
export const hitTarget = { normal: 44, sleep: 48, kids: 56 };

export default { FONTS, FONT_MAP, type, spacing, radius, elevation, motion, hitTarget };
