import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

type LockState = {
  unlocked: boolean;
  /** Gerät hat Biometrie/PIN eingerichtet. null = noch nicht geprüft. */
  available: boolean | null;
  checkAvailability: () => Promise<boolean>;
  unlock: () => Promise<{ ok: boolean; reason?: string }>;
  lock: () => void;
};

export const useAppLock = create<LockState>((set, get) => ({
  unlocked: false,
  available: null,
  checkAvailability: async () => {
    if (Platform.OS === 'web') {
      set({ available: false });
      return false;
    }
    try {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      const ok = level !== LocalAuthentication.SecurityLevel.NONE;
      set({ available: ok });
      return ok;
    } catch {
      set({ available: false });
      return false;
    }
  },
  unlock: async () => {
    const available = get().available ?? (await get().checkAvailability());
    if (!available) {
      // Ohne Displaysperre am Gerät kann nicht gesperrt werden – Zugang erlauben.
      set({ unlocked: true });
      return { ok: true, reason: 'unavailable' };
    }
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Satzwerk entsperren',
        cancelLabel: 'Abbrechen',
        disableDeviceFallback: false,
      });
      if (r.success) {
        set({ unlocked: true });
        return { ok: true };
      }
      return { ok: false, reason: r.error };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'Fehler' };
    }
  },
  lock: () => set({ unlocked: false }),
}));

let subscribed = false;
/** Sperrt wieder, sobald die App in den Hintergrund geht. Einmalig aufrufen. */
export function subscribeAutoLock(): void {
  if (subscribed) return;
  subscribed = true;
  AppState.addEventListener('change', (state) => {
    // Kurz eingeblendete System-Dialoge (z. B. Fingerabdruck) melden 'inactive' – nur bei 'background' sperren.
    if (state === 'background') useAppLock.getState().lock();
  });
}
