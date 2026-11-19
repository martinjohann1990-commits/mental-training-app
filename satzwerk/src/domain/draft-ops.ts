/**
 * Reine Operationen auf einer Übungsliste (Routinen-Editor und Live-Workout teilen sie sich).
 */
import type { LoggingType } from './catalog';
import {
  DEFAULT_REST_SECONDS,
  type DraftExercise,
  type DraftSet,
  emptySet,
  fieldsFor,
  hasValues,
  type IntervalConfig,
  newKey,
  normalizeGroups,
  type SetValues,
} from './workout';

export type ExerciseList = DraftExercise[];

export function newDraftExercise(exerciseId: string, restSeconds = DEFAULT_REST_SECONDS): DraftExercise {
  return { key: newKey(), exerciseId, supersetGroup: null, restSeconds, note: '', interval: null, sets: [emptySet()] };
}

function mapExercise(list: ExerciseList, exKey: string, fn: (e: DraftExercise) => DraftExercise): ExerciseList {
  return list.map((e) => (e.key === exKey ? fn(e) : e));
}

export function addExercises(list: ExerciseList, exerciseIds: string[], restSeconds?: number): ExerciseList {
  return [...list, ...exerciseIds.map((id) => newDraftExercise(id, restSeconds))];
}

export function removeExercise(list: ExerciseList, exKey: string): ExerciseList {
  return normalizeGroups(list.filter((e) => e.key !== exKey));
}

export function moveExercise(list: ExerciseList, exKey: string, delta: -1 | 1): ExerciseList {
  const i = list.findIndex((e) => e.key === exKey);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return normalizeGroups(copy);
}

export function patchExercise(
  list: ExerciseList,
  exKey: string,
  patch: Partial<Pick<DraftExercise, 'note' | 'restSeconds' | 'interval'>>,
): ExerciseList {
  return mapExercise(list, exKey, (e) => ({ ...e, ...patch }));
}

/** Neuer Satz übernimmt die Werte des letzten Satzes (aber nicht den Status). */
export function addSet(list: ExerciseList, exKey: string): ExerciseList {
  return mapExercise(list, exKey, (e) => {
    const last = e.sets[e.sets.length - 1];
    const s = emptySet(last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal'));
    if (last) {
      s.weight = last.weight;
      s.reps = last.reps;
      s.repsRight = last.repsRight;
      s.duration = last.duration;
      s.distance = last.distance;
    }
    return { ...e, sets: [...e.sets, s] };
  });
}

export function removeSet(list: ExerciseList, exKey: string, setKey: string): ExerciseList {
  return mapExercise(list, exKey, (e) => ({ ...e, sets: e.sets.filter((s) => s.key !== setKey) }));
}

export function patchSet(list: ExerciseList, exKey: string, setKey: string, patch: Partial<DraftSet>): ExerciseList {
  return mapExercise(list, exKey, (e) => ({
    ...e,
    sets: e.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)),
  }));
}

/**
 * Hakt einen Satz ab bzw. wieder auf. Leere Felder werden beim Abhaken aus `fallback`
 * (Werte vom letzten Mal) übernommen. Gibt null zurück, wenn der Satz danach keine Werte hat.
 */
export function toggleSetComplete(
  list: ExerciseList,
  exKey: string,
  setKey: string,
  loggingType: LoggingType,
  fallback: SetValues | null,
): ExerciseList | null {
  const ex = list.find((e) => e.key === exKey);
  const set = ex?.sets.find((s) => s.key === setKey);
  if (!ex || !set) return list;
  if (set.completed) return patchSet(list, exKey, setKey, { completed: false });

  const filled: DraftSet = { ...set };
  if (fallback) {
    for (const f of fieldsFor(loggingType)) {
      if (filled[f] === null) filled[f] = fallback[f];
    }
  }
  if (!hasValues(filled, loggingType)) return null;
  return patchSet(list, exKey, setKey, { ...filled, completed: true });
}

/** Ergebnis eines Intervall-Blocks als Sätze eintragen. */
export function applyIntervalResult(
  list: ExerciseList,
  exKey: string,
  config: IntervalConfig,
  result: { totalReps: number | null },
): ExerciseList {
  return mapExercise(list, exKey, (e) => {
    const weight = e.sets.find((s) => s.weight !== null)?.weight ?? null;
    const done = e.sets.filter((s) => s.completed);
    let newSets: DraftSet[] = [];
    if (config.mode === 'emom') {
      newSets = Array.from({ length: config.minutes }, () => ({
        ...emptySet(),
        weight,
        reps: config.repsPerMinute,
        duration: config.repsPerMinute ? null : 60,
        completed: true,
      }));
    } else if (config.mode === 'amrap') {
      newSets = [{ ...emptySet(), weight, reps: result.totalReps, duration: config.minutes * 60, completed: true }];
    } else {
      newSets = Array.from({ length: config.rounds }, () => ({
        ...emptySet(),
        weight,
        duration: config.workSeconds,
        completed: true,
      }));
      if (result.totalReps && newSets.length > 0) {
        // Gesamtwiederholungen gleichmäßig verteilen (Rest auf die ersten Runden).
        const base = Math.floor(result.totalReps / newSets.length);
        let rest = result.totalReps - base * newSets.length;
        newSets = newSets.map((s) => ({ ...s, reps: base + (rest-- > 0 ? 1 : 0) }));
      }
    }
    return { ...e, sets: [...done, ...newSets] };
  });
}
