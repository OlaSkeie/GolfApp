/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    tint: '#16A34A',
    border: '#E6E8EB',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    tint: '#22C55E',
    border: '#2A2D31',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

/**
 * ARC — «Golf IQ» design system. Clean, light, airy. Green accent used sparingly.
 * Light-only tokens; ported from the reference design spec.
 */
export const Arc = {
  color: {
    appBg: '#f3f4f1',
    surface: '#ffffff',
    surface2: '#fafbf8',
    ink: '#15201a',
    ink2: '#5a655d',
    ink3: '#98a09a',
    line: 'rgba(20,32,26,0.07)',
    line2: 'rgba(20,32,26,0.12)',
    accent: '#1f8a5b',
    accentD: '#136844',
    accentWash: '#e9f3ed',
    accentWash2: '#d6ebde',
    flag: '#b07a2e',
    flagWash: '#f4ede0',
    sky: '#3f78b0',
    skyWash: '#e8f0f6',
  },
  radius: { xs: 10, sm: 14, md: 20, lg: 26, xl: 32, pill: 999 },
  // myke skygger (RN-format)
  shadow: {
    sm: {
      shadowColor: '#142016',
      shadowOpacity: 0.06,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    md: {
      shadowColor: '#142016',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
