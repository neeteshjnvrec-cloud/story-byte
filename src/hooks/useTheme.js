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
    background: '#F6EFE4', surface: '#FCF7EF', surfaceElevated: '#FFFFFF', card: '#FCF7EF', cardAlt: '#FBEEE9',
    text: '#2A2118', textSecondary: '#7A6E5F', textTertiary: '#A99C89',
    border: '#EADFCC', divider: '#F1E1D3',
    accent: '#B5613A', accentSoft: 'rgba(181,97,58,0.12)', accentMuted: '#93472A', onAccent: '#FFFFFF',
    primary: '#B5613A', secondary: '#E0913A',
    success: '#4B8B6F', warning: '#B4863A', error: '#C6553F',
    successSoft: '#E6F1EA', warningSoft: '#F6ECD8', errorSoft: '#F7E6E1',
    scrim: 'rgba(42,33,24,0.55)', focusRing: '#B5613A',
    skeletonBase: '#EFE6D6', skeletonHighlight: '#FAF4EA',
    ratingActive: '#E0913A', ratingInactive: '#DBCDB6',
    tabBarActive: '#B5613A', tabBarInactive: '#A99C89',
    gradientStart: '#B5613A', gradientMid: '#D07C43', gradientEnd: '#E0913A',
  },
  dark: {
    background: '#17110C', surface: '#211913', surfaceElevated: '#2B211A', card: '#211913', cardAlt: '#2B211A',
    text: '#F3E9DB', textSecondary: '#B8A991', textTertiary: '#7F7261',
    border: '#3A2E24', divider: '#2B211A',
    accent: '#D98A5E', accentSoft: 'rgba(217,138,94,0.16)', accentMuted: '#B5613A', onAccent: '#17110C',
    primary: '#D98A5E', secondary: '#E8B04B',
    success: '#5FA98A', warning: '#E0A44B', error: '#E07A63',
    successSoft: '#15241D', warningSoft: '#26200F', errorSoft: '#2A1712',
    scrim: 'rgba(0,0,0,0.6)', focusRing: '#D98A5E',
    skeletonBase: '#241B14', skeletonHighlight: '#30251C',
    ratingActive: '#E8B04B', ratingInactive: '#4A3B2E',
    tabBarActive: '#D98A5E', tabBarInactive: '#7F7261',
    gradientStart: '#B5613A', gradientMid: '#C77A45', gradientEnd: '#E0913A',
  },
  sleep: {
    background: '#070A12', surface: '#0E121C', surfaceElevated: '#151A26', card: '#131826', cardAlt: '#171C2B',
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
    background: '#FFFDF7', surface: '#FFF4DE', surfaceElevated: '#FFFFFF', card: '#FFFFFF', cardAlt: '#FFF1EC',
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
    light: { accent: '#B5613A', gradientStart: '#B5613A', gradientMid: '#D07C43', gradientEnd: '#E0913A', onAccent: '#FFFFFF' },
    dark: { accent: '#D98A5E', gradientStart: '#B5613A', gradientMid: '#C77A45', gradientEnd: '#E0913A', onAccent: '#17110C' },
  },
  fiction: {
    light: { accent: '#B5613A', gradientStart: '#B5613A', gradientMid: '#D07C43', gradientEnd: '#E0913A', onAccent: '#FFFFFF' },
    dark: { accent: '#D98A5E', gradientStart: '#B5613A', gradientMid: '#C77A45', gradientEnd: '#E0913A', onAccent: '#17110C' },
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
    light: { accent: '#E0913A', gradientStart: '#E0913A', gradientMid: '#EAA24B', gradientEnd: '#E8B04B', onAccent: '#FFFFFF' },
    dark: { accent: '#FB923C', gradientStart: '#C2410C', gradientMid: '#EA6D2A', gradientEnd: '#F59E0B', onAccent: '#1A1206' },
  },
};

const SYSTEM_THEME = 'system';
const STORAGE_MODE = 'storybyte-theme';
const STORAGE_UIMODE = 'storybyte-ui-mode';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Default to the warm light identity (the approved design); users can switch
  // to system/dark in Settings.
  const [themeMode, setThemeMode] = useState('light'); // system | light | dark
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
        // Only honor an explicit light/dark choice; ignore stale 'system'
        // so the app opens in the approved light identity by default.
        if (savedTheme === 'light' || savedTheme === 'dark') setThemeMode(savedTheme);
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
  try {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
      return {
        theme: THEMES.light, tokens, themeMode: 'light', isDark: false,
        mode: 'normal', vertical: 'general',
        changeTheme: () => {}, setMode: () => {}, setVertical: () => {},
      };
    }
    return ctx;
  } catch (e) {
    // Return fallback if context is not available
    return {
      theme: THEMES.light, tokens, themeMode: 'light', isDark: false,
      mode: 'normal', vertical: 'general',
      changeTheme: () => {}, setMode: () => {}, setVertical: () => {},
    };
  }
};

export const useThemeContext = useTheme;
export { THEMES };
