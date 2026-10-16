import { useColorScheme } from 'react-native';
import { useApp } from '../state/app';

const shared = {
  accent: '#F2620F',
  accentPressed: '#D9530A',
  onAccent: '#111111', // white on #F2620F is ~3.2:1; near-black clears 4.5:1
  success: '#3FA34D',
  danger: '#E5484D',
};

export const palette = {
  light: {
    ...shared,
    bg: '#F2F2F3',
    surface: '#FFFFFF',
    surface2: '#E8E8EA',
    ink: '#111111',
    muted: '#62626A',
    line: '#DEDEE2',
    accentText: '#B3470A',
    accentTint: '#FFE8D9',
    series2: '#2563EB',
    invert: '#111111',
    onInvert: '#FFFFFF',
  },
  dark: {
    ...shared,
    bg: '#000000',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    ink: '#F5F5F5',
    muted: '#9A9AA0',
    line: '#2C2C2E',
    accentText: '#FF7A2E',
    accentTint: '#3A1E0D',
    series2: '#4C8DFF',
    invert: '#F5F5F5',
    onInvert: '#111111',
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
