import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getSetting, setSetting } from '../outbox/db';
import {
  darkColors, lightColors, FONT_SCALES,
  type FontScale, type ThemeColors, type ThemeMode,
} from './theme';

const SETTING_THEME_MODE = 'theme.mode';
const SETTING_FONT_SCALE = 'theme.font_scale';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  colors: ThemeColors;
  /** Multiplier applied to font sizes; derived from fontScale. */
  fontFactor: number;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function loadMode(): ThemeMode {
  const stored = getSetting(SETTING_THEME_MODE);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function loadFontScale(): FontScale {
  const stored = getSetting(SETTING_FONT_SCALE);
  return stored === 'small' || stored === 'medium' || stored === 'large' ? stored : 'medium';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(loadMode);
  const [fontScale, setFontScaleState] = useState<FontScale>(loadFontScale);

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
    return {
      mode,
      setMode: (next: ThemeMode) => {
        setSetting(SETTING_THEME_MODE, next);
        setModeState(next);
      },
      fontScale,
      setFontScale: (next: FontScale) => {
        setSetting(SETTING_FONT_SCALE, next);
        setFontScaleState(next);
      },
      colors: isDark ? darkColors : lightColors,
      fontFactor: FONT_SCALES[fontScale],
      isDark,
    };
  }, [mode, fontScale, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return context;
}
