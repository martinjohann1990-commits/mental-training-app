import { create } from 'zustand';

import { deleteSetting, readSetting, writeSetting } from '@/db/repo/settings';
import * as ops from '@/domain/draft-ops';
import type { LoggingType } from '@/domain/catalog';
import { type DraftExercise, type DraftSet, type IntervalConfig, restAfterSet, type SetValues, toggleSupersetWithNext, type WorkoutDraft } from '@/domain/workout';
import { cancelRestEnd, scheduleRestEnd } from '@/lib/rest-alerts';

const STORAGE_KEY = 'activeWorkout';

type State = {
  draft: WorkoutDraft | null;
  /** Kurzer Hinweis, z. B. „Supersatz – weiter mit …“ (id ändert sich bei jedem neuen Hinweis). */
  hint: { id: number; text: string } | null;
  clearHint: () => void;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  start: (init: { name: string; routineId?: string | null; exercises?: DraftExercise[] }) => void;
  discard: () => void;
  rename: (name: string) => void;
  setExercises: (fn: (list: DraftExercise[]) => DraftExercise[]) => void;
  addExercises: (ids: string[]) => void;
  removeExercise: (exKey: string) => void;
  moveExercise: (exKey: string, delta: -1 | 1) => void;
  patchExercise: (exKey: string, patch: Partial<Pick<DraftExercise, 'note' | 'restSeconds' | 'interval'>>) => void;
  toggleSuperset: (exKey: string) => void;
  addSet: (exKey: string) => void;
  removeSet: (exKey: string, setKey: string) => void;
  patchSet: (exKey: string, setKey: string, patch: Partial<DraftSet>) => void;
  /** false = Satz hatte keine Werte und wurde nicht abgehakt. */
  toggleSet: (
    exKey: string,
    setKey: string,
    loggingType: LoggingType,
    fallback: SetValues | null,
    nextExerciseName?: string,
  ) => boolean;
  applyInterval: (exKey: string, config: IntervalConfig, totalReps: number | null) => void;
  startRest: (seconds: number, nextExerciseName?: string) => void;
  adjustRest: (deltaSeconds: number) => void;
  skipRest: () => void;
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist(draft: WorkoutDraft | null) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void (draft ? writeSetting(STORAGE_KEY, draft) : deleteSetting(STORAGE_KEY)), 250);
}

export const useActiveWorkout = create<State>((set, get) => {
  /** Ändert den Entwurf und speichert ihn (verzögert) in der DB. */
  const update = (fn: (d: WorkoutDraft) => WorkoutDraft) => {
    const d = get().draft;
    if (!d) return;
    const next = fn(d);
    set({ draft: next });
    persist(next);
  };
  const updateList = (fn: (l: DraftExercise[]) => DraftExercise[]) => update((d) => ({ ...d, exercises: fn(d.exercises) }));

  return {
    draft: null,
    hint: null,
    clearHint: () => set({ hint: null }),
    hydrated: false,
    hydrate: async () => {
      const saved = (await readSetting(STORAGE_KEY)) as WorkoutDraft | null;
      const valid = saved && typeof saved === 'object' && Array.isArray(saved.exercises) ? saved : null;
      // Abgelaufene Pause nicht wiederherstellen.
      if (valid?.rest && valid.rest.endsAt < Date.now()) valid.rest = null;
      set({ draft: valid, hydrated: true });
    },
    start: ({ name, routineId = null, exercises = [] }) => {
      const draft: WorkoutDraft = { name, routineId, startedAt: Date.now(), exercises, rest: null };
      set({ draft });
      persist(draft);
    },
    discard: () => {
      void cancelRestEnd(get().draft?.rest?.notificationId);
      set({ draft: null });
      persist(null);
    },
    rename: (name) => update((d) => ({ ...d, name })),
    setExercises: (fn) => updateList(fn),
    addExercises: (ids) => updateList((l) => ops.addExercises(l, ids)),
    removeExercise: (k) => updateList((l) => ops.removeExercise(l, k)),
    moveExercise: (k, delta) => updateList((l) => ops.moveExercise(l, k, delta)),
    patchExercise: (k, patch) => updateList((l) => ops.patchExercise(l, k, patch)),
    toggleSuperset: (k) => updateList((l) => toggleSupersetWithNext(l, l.findIndex((e) => e.key === k))),
    addSet: (k) => updateList((l) => ops.addSet(l, k)),
    removeSet: (k, s) => updateList((l) => ops.removeSet(l, k, s)),
    patchSet: (k, s, patch) => updateList((l) => ops.patchSet(l, k, s, patch)),
    toggleSet: (exKey, setKey, loggingType, fallback, nextExerciseName) => {
      const d = get().draft;
      if (!d) return false;
      const wasCompleted = d.exercises.find((e) => e.key === exKey)?.sets.find((s) => s.key === setKey)?.completed;
      const next = ops.toggleSetComplete(d.exercises, exKey, setKey, loggingType, fallback);
      if (!next) return false;
      update((dd) => ({ ...dd, exercises: next }));
      if (!wasCompleted) {
        const idx = next.findIndex((e) => e.key === exKey);
        const rest = restAfterSet(next, idx);
        if (rest > 0) get().startRest(rest, nextExerciseName);
        else if (next[idx]?.supersetGroup !== null) {
          // Im Supersatz/Zirkel läuft die Pause erst nach der letzten Übung der Runde.
          const group = next.filter((e) => e.supersetGroup === next[idx].supersetGroup);
          const label = group.length > 2 ? 'Zirkel' : 'Supersatz';
          set({ hint: { id: Date.now(), text: `${label}: ohne Pause weiter${nextExerciseName ? ` mit ${nextExerciseName}` : ''} – Pause nach der Runde` } });
        }
      }
      return true;
    },
    applyInterval: (k, config, totalReps) => updateList((l) => ops.applyIntervalResult(l, k, config, { totalReps })),
    startRest: (seconds, nextExerciseName) => {
      const d = get().draft;
      if (!d) return;
      void cancelRestEnd(d.rest?.notificationId);
      const endsAt = Date.now() + seconds * 1000;
      update((dd) => ({ ...dd, rest: { endsAt, total: seconds, notificationId: null } }));
      void scheduleRestEnd(seconds, nextExerciseName).then((notificationId) => {
        // Nur übernehmen, wenn die Pause inzwischen nicht ersetzt wurde.
        if (get().draft?.rest?.endsAt === endsAt) update((dd) => ({ ...dd, rest: dd.rest && { ...dd.rest, notificationId } }));
        else void cancelRestEnd(notificationId);
      });
    },
    adjustRest: (delta) => {
      const r = get().draft?.rest;
      if (!r) return;
      const remaining = Math.round((r.endsAt - Date.now()) / 1000) + delta;
      if (remaining <= 0) get().skipRest();
      else get().startRest(remaining);
    },
    skipRest: () => {
      void cancelRestEnd(get().draft?.rest?.notificationId);
      update((d) => ({ ...d, rest: null }));
    },
  };
});
