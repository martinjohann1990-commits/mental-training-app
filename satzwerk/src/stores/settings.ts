import { create } from 'zustand';

import { readAllSettings, writeSetting } from '@/db/repo/settings';

export type Unit = 'kg' | 'lbs';
export type ThemePreference = 'dark' | 'light' | 'system';
export type AppLockMode = 'off' | 'photos' | 'app';

type SettingsState = {
  loaded: boolean;
  unit: Unit;
  theme: ThemePreference;
  activeProfileId: string;
  appLock: AppLockMode;
  load: () => Promise<void>;
  setUnit: (unit: Unit) => void;
  setTheme: (theme: ThemePreference) => void;
  setActiveProfileId: (id: string) => void;
  setAppLock: (mode: AppLockMode) => void;
};

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export const useSettings = create<SettingsState>((set) => ({
  loaded: false,
  unit: 'kg',
  theme: 'dark',
  activeProfileId: 'home',
  appLock: 'photos',
  load: async () => {
    const s = await readAllSettings();
    set({
      loaded: true,
      unit: pick(s.unit, ['kg', 'lbs'] as const, 'kg'),
      theme: pick(s.theme, ['dark', 'light', 'system'] as const, 'dark'),
      activeProfileId: typeof s.activeProfileId === 'string' ? s.activeProfileId : 'home',
      appLock: pick(s.appLock, ['off', 'photos', 'app'] as const, 'photos'),
    });
  },
  setUnit: (unit) => {
    set({ unit });
    void writeSetting('unit', unit);
  },
  setTheme: (theme) => {
    set({ theme });
    void writeSetting('theme', theme);
  },
  setActiveProfileId: (activeProfileId) => {
    set({ activeProfileId });
    void writeSetting('activeProfileId', activeProfileId);
  },
  setAppLock: (appLock) => {
    set({ appLock });
    void writeSetting('appLock', appLock);
  },
}));
