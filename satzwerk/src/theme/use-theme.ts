import { useColorScheme } from 'react-native';

import { useSettings } from '@/stores/settings';

import { palette, type ThemeColors } from './colors';

export function useColorMode(): 'dark' | 'light' {
  const pref = useSettings((s) => s.theme);
  const system = useColorScheme();
  if (pref === 'system') return system === 'light' ? 'light' : 'dark';
  return pref;
}

export function useColors(): ThemeColors {
  return palette[useColorMode()];
}
