export const ACCENT = '#FF6B1A';

export const palette = {
  dark: {
    background: '#0E0F11',
    surface: '#17191C',
    surfaceAlt: '#202327',
    border: '#2B2F34',
    text: '#F4F5F6',
    textMuted: '#9AA0A6',
    accent: ACCENT,
    accentMuted: '#3A2214',
    onAccent: '#140800',
    danger: '#FF5C5C',
    success: '#3DD68C',
  },
  light: {
    background: '#F6F6F7',
    surface: '#FFFFFF',
    surfaceAlt: '#EEEFF1',
    border: '#DDDFE3',
    text: '#141518',
    textMuted: '#5F656D',
    accent: '#E85A0C',
    accentMuted: '#FFE6D6',
    onAccent: '#FFFFFF',
    danger: '#D93636',
    success: '#1F9D63',
  },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['dark']]: string };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
