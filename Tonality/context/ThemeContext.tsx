import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  mode: ThemeMode;
  colorScheme: Exclude<ColorSchemeName, null>;
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentMuted: string;
    success: string;
    danger: string;
    tabBar: string;
    tabBorder: string;
    shadow: string;
  };
}

interface ThemeContextValue {
  theme: Theme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const THEME_MODE_KEY = 'tonality_theme_mode';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const lightPalette: Theme['colors'] = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F6',
  border: '#E2E6EE',
  text: '#101828',
  textMuted: '#6B7280',
  accent: '#1DB954',
  accentMuted: '#DCF6E8',
  success: '#16A34A',
  danger: '#EF4444',
  tabBar: '#FFFFFF',
  tabBorder: '#E2E6EE',
  shadow: 'rgba(15, 23, 42, 0.08)'
};

const darkPalette: Theme['colors'] = {
  background: '#05060A',
  surface: '#151927',
  surfaceMuted: '#1F2434',
  border: '#2A3042',
  text: '#F8FAFC',
  textMuted: '#AEB7CC',
  accent: '#1DB954',
  accentMuted: 'rgba(29, 185, 84, 0.15)',
  success: '#22C55E',
  danger: '#F87171',
  tabBar: '#0D101B',
  tabBorder: '#1E2433',
  shadow: 'rgba(0, 0, 0, 0.35)'
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    (async () => {
      try {
        const storedMode = await SecureStore.getItemAsync(THEME_MODE_KEY) as ThemeMode | null;
        if (storedMode) {
          setThemeModeState(storedMode);
        }
      } finally {
        // no-op
      }
    })();
  }, []);

  const resolvedScheme: Exclude<ColorSchemeName, null> = useMemo(() => {
    if (themeMode === 'system') {
      return (systemScheme ?? 'light');
    }
    return themeMode;
  }, [systemScheme, themeMode]);

  const colors = resolvedScheme === 'dark' ? darkPalette : lightPalette;

  const value = useMemo<ThemeContextValue>(() => ({
    theme: {
      mode: themeMode,
      colorScheme: resolvedScheme,
      colors,
    },
    setThemeMode: async (mode: ThemeMode) => {
      setThemeModeState(mode);
      await SecureStore.setItemAsync(THEME_MODE_KEY, mode);
    },
  }), [colors, resolvedScheme, themeMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
