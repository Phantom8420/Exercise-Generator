import { useColorScheme } from 'react-native';
import { useApp } from '../state/app';

const shared = {
  accent: '#F76B15',
  accentPressed: '#E05A08',
  onAccent: '#FFFFFF', // matches the reference; labels are bold 16px to stay legible
  success: '#3FA34D',
  danger: '#E5484D',
};

export const palette = {
  light: {
    ...shared,
    bg: '#FFFFFF',
    surface: '#F7F7F8',
    surface2: '#EFEFF1',
    raised: '#FFFFFF',
    ink: '#0E0E10',
    muted: '#6E6E76',
    line: '#EBEBED',
    accentText: '#C2510A',
    accentTint: '#FFF0E5',
    series2: '#2563EB',
    // hero blocks sit straight on the page, like the reference screens
    invert: 'transparent',
    onInvert: '#0E0E10',
  },
  dark: {
    ...shared,
    bg: '#000000',
    surface: '#121214',
    surface2: '#1E1E21',
    raised: '#2E2E32',
    ink: '#F5F5F5',
    muted: '#8E8E95',
    line: '#232326',
    accentText: '#FF8A3D',
    accentTint: '#2A1608',
    series2: '#4C8DFF',
    invert: 'transparent',
    onInvert: '#F5F5F5',
  },
};
export type Colors = typeof palette.light;
export type ColorName = { [K in keyof Colors]: Colors[K] extends string ? K : never }[keyof Colors];

export const font = {
  x: 'PlusJakartaSans_800ExtraBold',
  b: 'PlusJakartaSans_700Bold',
  s: 'PlusJakartaSans_600SemiBold',
  m: 'PlusJakartaSans_500Medium',
};

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 36 };
export const radius = { card: 24, field: 14, pill: 999 };

export function useTheme() {
  const system = useColorScheme();
  const pref = useApp((s) => s.theme);
  const dark = pref === 'system' ? system === 'dark' : pref === 'dark';
  return { c: dark ? palette.dark : palette.light, dark };
}
