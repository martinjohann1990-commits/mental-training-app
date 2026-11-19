import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useId } from 'react';

/**
 * Hält den Bildschirm an, solange die Komponente aktiv ist.
 * Fehler (z. B. Browser ohne Wake-Lock-Unterstützung) werden bewusst ignoriert.
 */
export function useKeepScreenOn(enabled = true): void {
  const tag = `satzwerk-${useId()}`;
  useEffect(() => {
    if (!enabled) return;
    let active = false;
    activateKeepAwakeAsync(tag)
      .then(() => {
        active = true;
      })
      .catch(() => {});
    return () => {
      if (!active) return;
      try {
        void Promise.resolve(deactivateKeepAwake(tag)).catch(() => {});
      } catch {
        // ignorieren
      }
    };
  }, [tag, enabled]);
}
