import type { LoggingType } from './catalog';

export const SET_TYPES = {
  warmup: { short: 'W', label: 'Aufwärmen' },
  normal: { short: '', label: 'Normal' },
  drop: { short: 'D', label: 'Dropsatz' },
  failure: { short: 'F', label: 'Bis Versagen' },
} as const;
export type SetType = keyof typeof SET_TYPES;
export const SET_TYPE_ORDER: SetType[] = ['normal', 'warmup', 'drop', 'failure'];

export function nextSetType(t: SetType): SetType {
  return SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(t) + 1) % SET_TYPE_ORDER.length];
}

/** Ein Satz – genutzt für Routinen-Vorgaben und geloggte Sätze. Alle Gewichte in kg. */
export type SetValues = {
  /** Gewicht bzw. Zusatzgewicht (negativ = Unterstützung) in kg. */
  weight: number | null;
  /** Wiederholungen (bei reps_per_side: links). */
  reps: number | null;
  /** Nur bei reps_per_side: rechts. */
  repsRight: number | null;
  /** Sekunden. */
  duration: number | null;
  /** Meter. */
  distance: number | null;
};

export type DraftSet = SetValues & {
  key: string;
  type: SetType;
  rpe: number | null;
  note: string;
  completed: boolean;
};

export type IntervalMode = 'emom' | 'amrap' | 'tabata';
export type IntervalConfig =
  | { mode: 'emom'; minutes: number; repsPerMinute: number | null }
  | { mode: 'amrap'; minutes: number }
  | { mode: 'tabata'; workSeconds: number; restSeconds: number; rounds: number };

export type DraftExercise = {
  key: string;
  exerciseId: string;
  /** Übungen mit gleicher Gruppen-Nummer bilden einen Supersatz/Zirkel. */
  supersetGroup: number | null;
  restSeconds: number;
  note: string;
  interval: IntervalConfig | null;
  sets: DraftSet[];
};

export type WorkoutDraft = {
  name: string;
  routineId: string | null;
  startedAt: number;
  exercises: DraftExercise[];
  rest: { endsAt: number; total: number; notificationId: string | null } | null;
};

export const DEFAULT_REST_SECONDS = 90;

let keyCounter = 0;
export function newKey(): string {
  keyCounter += 1;
  return `${Date.now().toString(36)}-${keyCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptySet(type: SetType = 'normal'): DraftSet {
  return {
    key: newKey(),
    type,
    weight: null,
    reps: null,
    repsRight: null,
    duration: null,
    distance: null,
    rpe: null,
    note: '',
    completed: false,
  };
}

/** Welche Eingabefelder ein Logging-Typ hat. */
export function fieldsFor(t: LoggingType): (keyof SetValues)[] {
  switch (t) {
    case 'weight_reps':
      return ['weight', 'reps'];
    case 'bodyweight_reps':
      return ['weight', 'reps'];
    case 'duration':
      return ['duration'];
    case 'weight_duration_distance':
      return ['weight', 'distance', 'duration'];
    case 'reps_per_side':
      return ['weight', 'reps', 'repsRight'];
  }
}

/** Ist ein Satz sinnvoll ausgefüllt (mind. ein Wert > 0)? */
export function hasValues(s: SetValues, t: LoggingType): boolean {
  return fieldsFor(t).some((f) => {
    if (f === 'weight') return false; // Gewicht allein reicht nicht
    const v = s[f];
    return v !== null && v > 0;
  });
}

/**
 * Pausenlogik für Supersätze: Innerhalb einer Gruppe wird nach jeder Übung
 * direkt zur nächsten gewechselt; die Pause startet erst nach der letzten Übung der Runde.
 * Liefert die Pausenlänge in Sekunden oder 0 (keine Pause).
 */
export function restAfterSet(exercises: DraftExercise[], exerciseIndex: number): number {
  const ex = exercises[exerciseIndex];
  if (!ex) return 0;
  if (ex.supersetGroup === null) return ex.restSeconds;
  const group = exercises.filter((e) => e.supersetGroup === ex.supersetGroup);
  const last = group[group.length - 1];
  return last.key === ex.key ? ex.restSeconds : 0;
}

/** Verknüpft Übung i mit der nächsten zu einem Supersatz bzw. löst die Verknüpfung. */
export function toggleSupersetWithNext(exercises: DraftExercise[], index: number): DraftExercise[] {
  const a = exercises[index];
  const b = exercises[index + 1];
  if (!a || !b) return exercises;
  const linked = a.supersetGroup !== null && a.supersetGroup === b.supersetGroup;
  const result = exercises.map((e) => ({ ...e }));
  if (linked) {
    // Gruppe an dieser Stelle aufteilen: alles ab b bekommt eine neue Nummer.
    const newGroup = nextGroupNumber(result);
    for (let i = index + 1; i < result.length && result[i].supersetGroup === a.supersetGroup; i++) {
      result[i].supersetGroup = newGroup;
    }
  } else {
    // a's Gruppe (oder eine neue) übernimmt b samt dessen bisheriger Gruppe.
    const group = a.supersetGroup ?? nextGroupNumber(result);
    const oldB = b.supersetGroup;
    result[index].supersetGroup = group;
    result[index + 1].supersetGroup = group;
    if (oldB !== null) result.forEach((e) => e.supersetGroup === oldB && (e.supersetGroup = group));
  }
  return normalizeGroups(result);
}

function nextGroupNumber(exercises: DraftExercise[]): number {
  return Math.max(0, ...exercises.map((e) => e.supersetGroup ?? 0)) + 1;
}

/** Gruppen mit nur einer Übung auflösen, Nummern fortlaufend vergeben. */
export function normalizeGroups(exercises: DraftExercise[]): DraftExercise[] {
  const counts = new Map<number, number>();
  exercises.forEach((e) => e.supersetGroup !== null && counts.set(e.supersetGroup, (counts.get(e.supersetGroup) ?? 0) + 1));
  const renumber = new Map<number, number>();
  let n = 0;
  return exercises.map((e) => {
    if (e.supersetGroup === null || (counts.get(e.supersetGroup) ?? 0) < 2) return { ...e, supersetGroup: null };
    if (!renumber.has(e.supersetGroup)) renumber.set(e.supersetGroup, ++n);
    return { ...e, supersetGroup: renumber.get(e.supersetGroup)! };
  });
}

/** Volumen (kg × Wdh.) über alle abgeschlossenen Arbeitssätze. */
export function setVolume(s: SetValues): number {
  const reps = (s.reps ?? 0) + (s.repsRight ?? 0);
  return Math.max(0, s.weight ?? 0) * reps;
}

export function workoutSummary(draft: Pick<WorkoutDraft, 'exercises'>) {
  let sets = 0;
  let volume = 0;
  for (const ex of draft.exercises) {
    for (const s of ex.sets) {
      if (!s.completed) continue;
      sets += 1;
      if (s.type !== 'warmup') volume += setVolume(s);
    }
  }
  return { exercises: draft.exercises.filter((e) => e.sets.some((s) => s.completed)).length, sets, volume };
}

/** Entfernt nicht abgehakte Sätze und leere Übungen – vor dem Speichern. */
export function pruneDraft(draft: WorkoutDraft): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) }))
      .filter((e) => e.sets.length > 0),
  };
}
