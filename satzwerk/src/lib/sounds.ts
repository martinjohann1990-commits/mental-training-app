import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { useSettings } from '@/stores/settings';

type SoundKind = 'tick' | 'end';
const players: Partial<Record<SoundKind, AudioPlayer>> = {};
let ready: Promise<void> | null = null;

/** Einmalig: Audio-Modus (auch im Lautlos-Modus, Musik wird kurz leiser) und Töne laden. */
export function initSounds(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: false });
      } catch {
        // Audio-Modus nicht verfügbar (z. B. Web) – Töne trotzdem versuchen
      }
      try {
        players.tick = createAudioPlayer(require('@/assets/sounds/tick.wav'));
        players.end = createAudioPlayer(require('@/assets/sounds/end.wav'));
        if (players.tick) players.tick.volume = 1;
        if (players.end) players.end.volume = 1;
      } catch {
        // Kein Audio – App läuft ohne Ton weiter
      }
    })();
  }
  return ready;
}

/** Spielt einen Signalton (wenn in den Einstellungen aktiviert). */
export function playSound(kind: SoundKind, force = false): void {
  if (!force && !useSettings.getState().restSound) return;
  void initSounds().then(async () => {
    const p = players[kind];
    if (!p) return;
    try {
      await p.seekTo(0);
      p.play();
    } catch {
      // ignorieren
    }
  });
}
