// Theme inspired by the app's hero image
// A sophisticated twilight palette for immersive storytelling

export const COLORS = {
  // Primary Colors - Deep twilight purple/blue palette
  primary: '#4f46e5',      // Indigo - sophisticated primary
  primaryDark: '#4338ca',   // Deeper indigo
  primaryLight: '#818cf8',  // Lighter indigo

  // Secondary Colors - Warm accents for contrast
  secondary: '#f59e0b',    // Amber - warm storytelling glow
  secondaryDark: '#d97706',
  secondaryLight: '#fbbf24',

  // Tertiary Colors - Additional palette from image
  tertiary: '#a855f7',     // Purple - mystical touch
  tertiaryDark: '#9333ea',
  tertiaryLight: '#c084fc',

  // Neutral Colors
  background: '#0f0f0f',
  surface: '#1a1a1a',
  card: '#242424',

  // Text Colors
  text: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',

  // Status Colors
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',

  // UI Elements
  border: '#374151',
  divider: '#2d2d2d',
  overlay: 'rgba(15, 15, 15, 0.85)',

  // Gradients - Inspired by twilight sky
  gradientStart: '#4f46e5',
  gradientEnd: '#7c3aed',
  gradientWarm: '#f59e0b',
  gradientCool: '#06b6d4',
};

// Spacing scale (matches Figma's spacing system)
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

// Border radius values (matches Figma's rounded corners)
export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
}

// Typography settings (matching Figma's typography scale)
export const TYPOGRAPHY = {
  h1: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
}

// Shadow effects for depth
export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  // Glow effect for active elements
  glow: {
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
};

// Story card color palette - inspired by twilight colors
// Each card gets a unique gradient-like background
export const STORY_CARD_COLORS = [
  // Deep twilight tones
  { bg: '#1e1b4b', border: '#4f46e5', text: '#c7d2fe' }, // Indigo
  { bg: '#1f2937', border: '#6366f1', text: '#c7d2fe' }, // Slate with indigo accent
  { bg: '#1e1b4b', border: '#8b5cf6', text: '#e0e7ff' }, // Purple
  { bg: '#111827', border: '#f59e0b', text: '#fef3c7' }, // Dark with amber
  { bg: '#1f2937', border: '#06b6d4', text: '#a5f3fc' }, // Cyan
  { bg: '#1e1b4b', border: '#ec4899', text: '#fce7f3' }, // Pink
  { bg: '#111827', border: '#10b981', text: '#a7f3d0' }, // Emerald
  { bg: '#1f2937', border: '#3b82f6', text: '#bfdbfe' }, // Blue
];

// Helper function to get card color by index
export const getStoryCardColor = (index) => {
  return STORY_CARD_COLORS[index % STORY_CARD_COLORS.length];
};

// Theme objects compatible with useTheme hook
export const LIGHT = {
  background: '#ffffff',
  surface: '#f9fafb',
  text: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  card: '#ffffff',
  accent: '#4f46e5',
  gradientStart: '#4f46e5',
  gradientEnd: '#7c3aed',
  divider: '#e5e7eb',
};

export const DARK = {
  background: '#0f0f0f',
  surface: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  border: '#374151',
  card: '#242424',
  accent: '#4f46e5',
  gradientStart: '#4f46e5',
  gradientEnd: '#7c3aed',
  divider: '#2d2d2d',
};

// Add gradientStart/gradientEnd to top-level export for backwards compatibility
export const gradientStart = COLORS.gradientStart;
export const gradientEnd = COLORS.gradientEnd;
