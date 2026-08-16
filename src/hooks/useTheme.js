// Theme system for StoryByte.
//
// Two orthogonal axes:
//   mode:     'normal' | 'sleep' | 'kids'   → chooses the palette family
//   vertical: 'fiction'|'bedtime'|'kids'|'hindi'|'general' → overlays the accent
//             (only in normal mode; sleep/kids keep their own calming/playful accent)
//
// In normal mode, light vs dark follows themeMode ('system' honors the OS).
// Every palette exposes the SAME key set so any screen can read any token.

import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tokens from '../theme/tokens';

const hexToRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// --- Palettes --------------------------------------------------------------
const THEMES = {
  light: {
    background: '#FFFFFF', surface: '#F5F6FA', surfaceElevated: '#FFFFFF', card: '#FFFFFF',
    text: '#0F1222', textSecondary: '#565B72', textTertiary: '#8A8FA3',
    border: '#E6E8F0', divider: '#EDEFF5',
    accent: '#4F46E5', accentSoft: 'rgba(79,70,229,0.12)', accentMuted: '#6D5AE6', onAccent: '#FFFFFF',
    primary: '#4F46E5', secondary: '#F59E0B',
    success: '#0E9F6E', warning: '#B45309', error: '#DC2626',
    successSoft: '#E6F6F0', warningSoft: '#FEF3E2', errorSoft: '#FCE9E9',
    scrim: 'rgba(15,18,34,0.55)', focusRing: '#4F46E5',
    skeletonBase: '#ECEEF4', skeletonHighlight: '#F7F8FC',
    ratingActive: '#F59E0B', ratingInactive: '#D3D7E3',
    tabBarActive: '#4F46E5', tabBarInactive: '#8A8FA3',
    gradientStart: '#4F46E5', gradientMid: '#6D5AE6', gradientEnd: '#7C3AED',
  },
  dark: {
    background: '#0B0B10', surface: '#14141C', surfaceElevated: '#1C1C28', card: '#1A1A24',
    text: '#F5F6FA', textSecondary: '#A6ABBD', textTertiary: '#6C7080',
    border: '#2A2C38', divider: '#23252F',
    accent: '#818CF8', accentSoft: 'rgba(129,140,248,0.16)', accentMuted: '#6366F1', onAccent: '#0B0B10',
    primary: '#818CF8', secondary: '#FBBF24',
    success: '#34D399', warning: '#FBBF24', error: '#F87171',
    successSoft: '#123227', warningSoft: '#322717', errorSoft: '#321B1B',
    scrim: 'rgba(0,0,0,0.6)', focusRing: '#A5B4FC',
    skeletonBase: '#1E1E2A', skeletonHighlight: '#2A2A3A',
    ratingActive: '#FBBF24', ratingInactive: '#3A3D4C',
    tabBarActive: '#818CF8', tabBarInactive: '#6C7080',
    gradientStart: '#4F46E5', gradientMid: '#6D28D9', gradientEnd: '#7C3AED',
  },
  sleep: {
    background: '#070A12', surface: '#0E121C', surfaceElevated: '#151A26', card: '#131826',
    text: '#CDD3E0', textSecondary: '#8590A6', textTertiary: '#5E687E',
    border: '#1E2433', divider: '#182031',
    accent: '#9AA0D8', accentSoft: 'rgba(154,160,216,0.14)', accentMuted: '#6B72A6', onAccent: '#070A12',
    primary: '#9AA0D8', secondary: '#D9A86B',
    success: '#4F9E86', warning: '#C79A5E', error: '#C97676',
    successSoft: '#0E1B17', warningSoft: '#1C160E', errorSoft: '#1C1010',
    scrim: 'rgba(0,0,0,0.7)', focusRing: '#9AA0D8',
    skeletonBase: '#121721', skeletonHighlight: '#1A2130',
    ratingActive: '#C79A5E', ratingInactive: '#2A3040',
    tabBarActive: '#9AA0D8', tabBarInactive: '#5E687E',
    gradientStart: '#141A2E', gradientMid: '#1B2036', gradientEnd: '#0B0F1C',
  },
  kids: {
    background: '#FFFDF7', surface: '#FFF4DE', surfaceElevated: '#FFFFFF', card: '#FFFFFF',
    text: '#2B2440', textSecondary: '#5B5470', textTertiary: '#8A82A0',
    border: '#F0E4C8', divider: '#F4EAD2',
    accent: '#FF6B6B', accentSoft: 'rgba(255,107,107,0.16)', accentMuted: '#FF8A8A', onAccent: '#FFFFFF',
    primary: '#FF6B6B', secondary: '#17B3A6',
    success: '#17B3A6', warning: '#FFB020', error: '#FF6B6B',
    successSoft: '#E4F7F4', warningSoft: '#FFF3DE', errorSoft: '#FFECEC',
    scrim: 'rgba(43,36,64,0.5)', focusRing: '#7C5CFF',
    skeletonBase: '#F4EAD2', skeletonHighlight: '#FFFBF0',
    ratingActive: '#FFB020', ratingInactive: '#E7DCC2',
    tabBarActive: '#FF6B6B', tabBarInactive: '#8A82A0',
    gradientStart: '#FF6B6B', gradientMid: '#FF9E7C', gradientEnd: '#FFC93C',
  },
};

// Bright playful card-accent rotation used in Kids mode.
export const KIDS_CARD_COLORS = ['#FF6B6B', '#17B3A6', '#7C5CFF', '#FFC93C', '#4FA9FF'];

// --- Per-vertical accent (overlaid in normal mode only) --------------------
const VERTICAL_ACCENTS = {
  general: {
    light: { accent: '#4F46E5', gradientStart: '#4F46E5', gradientMid: '#6D5AE6', gradientEnd: '#7C3AED', onAccent: '#FFFFFF' },
    dark: { accent: '#818CF8', gradientStart: '#4F46E5', gradientMid: '#6D28D9', gradientEnd: '#7C3AED', onAccent: '#0B0B10' },
  },
  fiction: {
    light: { accent: '#4F46E5', gradientStart: '#4F46E5', gradientMid: '#6D5AE6', gradientEnd: '#7C3AED', onAccent: '#FFFFFF' },
    dark: { accent: '#818CF8', gradientStart: '#4F46E5', gradientMid: '#6D28D9', gradientEnd: '#7C3AED', onAccent: '#0B0B10' },
  },
  bedtime: {
    light: { accent: '#7C6FD6', gradientStart: '#7C6FD6', gradientMid: '#6D5AE6', gradientEnd: '#4F46E5', onAccent: '#FFFFFF' },
    dark: { accent: '#9AA0D8', gradientStart: '#3A3F6B', gradientMid: '#2A2E52', gradientEnd: '#1B2036', onAccent: '#070A12' },
  },
  kids: {
    light: { accent: '#FF6B6B', gradientStart: '#FF6B6B', gradientMid: '#FF9E7C', gradientEnd: '#FFC93C', onAccent: '#FFFFFF' },
    dark: { accent: '#FF8A8A', gradientStart: '#FF6B6B', gradientMid: '#FF9E7C', gradientEnd: '#FFC93C', onAccent: '#2B2440' },
  },
  hindi: {
    light: { accent: '#EA6D2A', gradientStart: '#EA6D2A', gradientMid: '#F59E0B', gradientEnd: '#FBBF24', onAccent: '#FFFFFF' },
    dark: { accent: '#FB923C', gradientStart: '#C2410C', gradientMid: '#EA6D2A', gradientEnd: '#F59E0B', onAccent: '#1A1206' },
  },
};

const SYSTEM_THEME = 'system';
const STORAGE_MODE = 'storybyte-theme';
const STORAGE_UIMODE = 'storybyte-ui-mode';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState(SYSTEM_THEME); // system | light | dark
  const [mode, setModeState] = useState('normal'); // normal | sleep | kids
  const [vertical, setVertical] = useState('general');
  const systemScheme = useColorScheme() || 'light';

  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedUiMode] = await Promise.all([
          AsyncStorage.getItem(STORAGE_MODE),
          AsyncStorage.getItem(STORAGE_UIMODE),
        ]);
        if (savedTheme) setThemeMode(savedTheme);
        if (savedUiMode) setModeState(savedUiMode);
      } catch (e) {}
    })();
  }, []);

  const isDark = themeMode === SYSTEM_THEME ? systemScheme === 'dark' : themeMode === 'dark';

  const changeTheme = (m) => {
    setThemeMode(m);
    AsyncStorage.setItem(STORAGE_MODE, m).catch(() => {});
  };

  const setMode = (m) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_UIMODE, m).catch(() => {});
  };

  const theme = useMemo(() => {
    let base;
    if (mode === 'sleep') base = THEMES.sleep;
    else if (mode === 'kids') base = THEMES.kids;
    else base = isDark ? THEMES.dark : THEMES.light;

    // Overlay the per-vertical accent only in normal mode.
    if (mode === 'normal') {
      const set = (VERTICAL_ACCENTS[vertical] || VERTICAL_ACCENTS.general)[isDark ? 'dark' : 'light'];
      return {
        ...base,
        accent: set.accent,
        primary: set.accent,
        accentSoft: hexToRgba(set.accent, isDark ? 0.16 : 0.12),
        onAccent: set.onAccent,
        gradientStart: set.gradientStart,
        gradientMid: set.gradientMid,
        gradientEnd: set.gradientEnd,
      };
    }
    return base;
  }, [mode, vertical, isDark]);

  const value = useMemo(
    () => ({ theme, tokens, themeMode, isDark, mode, vertical, changeTheme, setMode, setVertical }),
    [theme, themeMode, isDark, mode, vertical]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Fallback keeps the app rendering even if a provider is missing.
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: THEMES.light, tokens, themeMode: 'light', isDark: false,
      mode: 'normal', vertical: 'general',
      changeTheme: () => {}, setMode: () => {}, setVertical: () => {},
    };
  }
  return ctx;
};

export const useThemeContext = useTheme;
export { THEMES };
