/**
 * Statistik-Berechnungen auf einer flachen Satz-Historie. Rein und testbar.
 */
import type { Muscle } from './catalog';
import type { SetType } from './workout';

export type HistorySet = {
  workoutId: string;
  startedAt: number;
  endedAt: number;
  exerciseId: string;
  type: SetType;
  weight: number | null;
  reps: number | null;
  repsRight: number | null;
  duration: number | null;
  distance: number | null;
};

export type WorkoutMetaLite = {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  rating: number | null;
  energy: number | null;
};

/** Geschätztes 1RM nach Epley; nur bis 12 Wdh. sinnvoll. */
export function estimate1RM(weight: number | null, reps: number | null): number | null {
  if (!weight || weight <= 0 || !reps || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

const totalReps = (s: Pick<HistorySet, 'reps' | 'repsRight'>) => (s.reps ?? 0) + (s.repsRight ?? 0);
const isWork = (s: HistorySet) => s.type !== 'warmup';

export function setVolumeOf(s: HistorySet): number {
  return isWork(s) ? Math.max(0, s.weight ?? 0) * totalReps(s) : 0;
}

export type ExerciseSession = {
  workoutId: string;
  date: number;
  sets: number;
  maxWeight: number | null;
  best1RM: number | null;
  volume: number;
  maxReps: number | null;
  totalReps: number;
  maxDuration: number | null;
  maxDistance: number | null;
  /** Bester Satz (nach 1RM, sonst Gewicht, sonst Wdh./Dauer). */
  bestSet: { weight: number | null; reps: number | null; repsRight: number | null; duration: number | null; distance: number | null } | null;
};

const maxOf = (vals: (number | null)[]) => {
  const v = vals.filter((x): x is number => x !== null && x > 0);
  return v.length ? Math.max(...v) : null;
};

/** Pro Workout eine Zeile für eine Übung, chronologisch aufsteigend. */
export function exerciseSessions(history: HistorySet[], exerciseId: string): ExerciseSession[] {
  const byWorkout = new Map<string, HistorySet[]>();
  for (const s of history) {
    if (s.exerciseId !== exerciseId) continue;
    const list = byWorkout.get(s.workoutId) ?? [];
    list.push(s);
    byWorkout.set(s.workoutId, list);
  }
  const sessions: ExerciseSession[] = [];
  for (const [workoutId, sets] of byWorkout) {
    const work = sets.filter(isWork);
    const pool = work.length ? work : sets;
    const scored = pool
      .map((s) => ({ s, score: estimate1RM(s.weight, s.reps) ?? (s.weight ?? 0) * 1000 + totalReps(s) + (s.duration ?? 0) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0]?.s ?? null;
    sessions.push({
      workoutId,
      date: sets[0].startedAt,
      sets: pool.length,
      maxWeight: maxOf(pool.map((s) => s.weight)),
      best1RM: maxOf(pool.map((s) => estimate1RM(s.weight, s.reps))),
      volume: pool.reduce((a, s) => a + setVolumeOf(s), 0),
      maxReps: maxOf(pool.map((s) => totalReps(s) || null)),
      totalReps: pool.reduce((a, s) => a + totalReps(s), 0),
      maxDuration: maxOf(pool.map((s) => s.duration)),
      maxDistance: maxOf(pool.map((s) => s.distance)),
      bestSet: best && {
        weight: best.weight,
        reps: best.reps,
        repsRight: best.repsRight,
        duration: best.duration,
        distance: best.distance,
      },
    });
  }
  return sessions.sort((a, b) => a.date - b.date);
}

export type PRKind = 'weight' | 'e1rm' | 'volume' | 'reps' | 'duration' | 'distance';
export const PR_LABELS: Record<PRKind, string> = {
  weight: 'Höchstes Gewicht',
  e1rm: 'Bestes 1RM (geschätzt)',
  volume: 'Meistes Volumen',
  reps: 'Meiste Wdh. (Satz)',
  duration: 'Längste Dauer',
  distance: 'Längste Distanz',
};

export type PersonalRecord = { kind: PRKind; value: number; date: number; workoutId: string };

const SESSION_KEY: Record<PRKind, keyof ExerciseSession> = {
  weight: 'maxWeight',
  e1rm: 'best1RM',
  volume: 'volume',
  reps: 'maxReps',
  duration: 'maxDuration',
  distance: 'maxDistance',
};

/** Aktuelle Bestwerte einer Übung (jeweils erste Erreichung). */
export function personalRecords(sessions: ExerciseSession[]): PersonalRecord[] {
  const out: PersonalRecord[] = [];
  for (const kind of Object.keys(SESSION_KEY) as PRKind[]) {
    let best: PersonalRecord | null = null;
    for (const s of sessions) {
      const v = s[SESSION_KEY[kind]] as number | null;
      if (v === null || v <= 0) continue;
      if (!best || v > best.value) best = { kind, value: v, date: s.date, workoutId: s.workoutId };
    }
    if (best) out.push(best);
  }
  return out;
}

/**
 * Welche Rekorde wurden in einem Workout neu aufgestellt? Ein Rekord zählt nur,
 * wenn es vorher schon eine Session gab (die allererste Session ist kein „PR“).
 */
export function prsInWorkout(history: HistorySet[], workoutId: string): { exerciseId: string; kind: PRKind; value: number }[] {
  const target = history.find((s) => s.workoutId === workoutId);
  if (!target) return [];
  const exerciseIds = [...new Set(history.filter((s) => s.workoutId === workoutId).map((s) => s.exerciseId))];
  const result: { exerciseId: string; kind: PRKind; value: number }[] = [];
  for (const exerciseId of exerciseIds) {
    const sessions = exerciseSessions(history, exerciseId);
    const idx = sessions.findIndex((s) => s.workoutId === workoutId);
    if (idx <= 0) continue;
    const before = sessions.slice(0, idx);
    const current = sessions[idx];
    for (const kind of Object.keys(SESSION_KEY) as PRKind[]) {
      const v = current[SESSION_KEY[kind]] as number | null;
      if (v === null || v <= 0) continue;
      const prevBest = Math.max(0, ...before.map((s) => (s[SESSION_KEY[kind]] as number | null) ?? 0));
      if (prevBest > 0 && v > prevBest + 1e-9) result.push({ exerciseId, kind, value: v });
    }
  }
  return result;
}

/** Montag 00:00 (lokal) der Woche von `t`. */
export function startOfWeek(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mo=0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function startOfMonth(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function addWeeks(t: number, n: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + 7 * n);
  return d.getTime();
}

export function addMonths(t: number, n: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
}

export type WeekBucket = { weekStart: number; volume: number; sets: number; workouts: number };

/** Volumen/Sätze/Workouts pro Woche für die letzten `weeks` Wochen (inkl. aktueller), aufsteigend. */
export function weeklyBuckets(history: HistorySet[], now: number, weeks: number): WeekBucket[] {
  const current = startOfWeek(now);
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addWeeks(current, i - weeks + 1),
    volume: 0,
    sets: 0,
    workouts: 0,
  }));
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
  const seen = new Set<string>();
  for (const s of history) {
    const i = index.get(startOfWeek(s.startedAt));
    if (i === undefined) continue;
    const b = buckets[i];
    if (isWork(s)) b.sets += 1;
    b.volume += setVolumeOf(s);
    if (!seen.has(s.workoutId)) {
      seen.add(s.workoutId);
      b.workouts += 1;
    }
  }
  return buckets;
}

/**
 * Arbeitssätze pro Muskelgruppe: Hauptmuskel zählt 1, sekundäre je 0,5.
 * Sortiert absteigend.
 */
export function muscleDistribution(
  history: HistorySet[],
  muscles: (exerciseId: string) => { primary: Muscle; secondary: Muscle[] } | undefined,
): { muscle: Muscle; sets: number }[] {
  const acc = new Map<Muscle, number>();
  for (const s of history) {
    if (!isWork(s)) continue;
    const m = muscles(s.exerciseId);
    if (!m) continue;
    acc.set(m.primary, (acc.get(m.primary) ?? 0) + 1);
    for (const sec of m.secondary) acc.set(sec, (acc.get(sec) ?? 0) + 0.5);
  }
  return [...acc.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

export type PeriodSummary = {
  start: number;
  end: number;
  workouts: number;
  durationSec: number;
  sets: number;
  volume: number;
  trainingDays: number;
  avgRating: number | null;
  avgEnergy: number | null;
  topExercises: { exerciseId: string; sets: number }[];
  prs: { exerciseId: string; kind: PRKind; value: number; workoutId: string }[];
};

/** Zusammenfassung für einen Zeitraum [start, end). */
export function summarizePeriod(
  history: HistorySet[],
  workouts: WorkoutMetaLite[],
  start: number,
  end: number,
): PeriodSummary {
  const inRange = (t: number) => t >= start && t < end;
  const ws = workouts.filter((w) => inRange(w.startedAt));
  const hs = history.filter((s) => inRange(s.startedAt));
  const days = new Set(ws.map((w) => new Date(w.startedAt).toDateString()));
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const exCount = new Map<string, number>();
  for (const s of hs) if (isWork(s)) exCount.set(s.exerciseId, (exCount.get(s.exerciseId) ?? 0) + 1);
  const prs = ws.flatMap((w) => prsInWorkout(history, w.id).map((p) => ({ ...p, workoutId: w.id })));
  return {
    start,
    end,
    workouts: ws.length,
    durationSec: ws.reduce((a, w) => a + Math.max(0, (w.endedAt - w.startedAt) / 1000), 0),
    sets: hs.filter(isWork).length,
    volume: hs.reduce((a, s) => a + setVolumeOf(s), 0),
    trainingDays: days.size,
    avgRating: avg(ws.map((w) => w.rating)),
    avgEnergy: avg(ws.map((w) => w.energy)),
    topExercises: [...exCount.entries()]
      .map(([exerciseId, sets]) => ({ exerciseId, sets }))
      .sort((a, b) => b.sets - a.sets)
      .slice(0, 5),
    prs,
  };
}

/** Prozentuale Veränderung, null wenn kein Vergleich möglich. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Längste Folge aufeinanderfolgender Wochen mit mindestens einem Workout, die bis zur aktuellen/letzten Woche reicht. */
export function weekStreak(workoutStarts: number[], now: number): number {
  const weeks = new Set(workoutStarts.map(startOfWeek));
  let w = startOfWeek(now);
  // Aktuelle Woche ohne Training bricht die Serie noch nicht.
  if (!weeks.has(w)) w = addWeeks(w, -1);
  let n = 0;
  while (weeks.has(w)) {
    n += 1;
    w = addWeeks(w, -1);
  }
  return n;
}
