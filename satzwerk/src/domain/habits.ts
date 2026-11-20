/**
 * Gewohnheiten: Erfüllung, Serien (Streaks) und Heatmap. Rein und testbar.
 * Tage werden als lokale 'YYYY-MM-DD'-Schlüssel behandelt.
 */
import { dayKey, dayToTime } from './body';
import { addWeeks, startOfWeek } from './stats';

export type HabitKind = 'check' | 'number' | 'workouts';
export type HabitFrequency = 'daily' | 'weekly';

export type HabitDef = {
  kind: HabitKind;
  /** Bei 'number': Tagesziel. */
  dailyTarget: number | null;
  frequency: HabitFrequency;
  /** Bei 'weekly': wie oft pro Woche (bei 'workouts' = Anzahl Workouts). */
  timesPerWeek: number | null;
};

/** day → Wert. Bei 'workouts' = Anzahl Workouts an dem Tag. */
export type HabitValues = Map<string, number>;

export function isDayDone(h: HabitDef, value: number | undefined): boolean {
  if (value === undefined || value <= 0) return false;
  if (h.kind === 'number') return value >= (h.dailyTarget ?? 1);
  return true;
}

export function addDays(day: string, n: number): string {
  const d = new Date(dayToTime(day));
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Erfüllte Tage einer Woche (Mo–So), bei 'workouts' = Summe der Workouts. */
export function weekCount(h: HabitDef, values: HabitValues, weekStart: number): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const v = values.get(dayKey(d));
    if (h.kind === 'workouts') n += v ?? 0;
    else if (isDayDone(h, v)) n += 1;
  }
  return n;
}

export function weekTarget(h: HabitDef): number {
  return Math.max(1, h.timesPerWeek ?? 1);
}

export type StreakInfo = {
  /** Aktuelle Serie (Tage bzw. Wochen). */
  current: number;
  best: number;
  unit: 'Tage' | 'Wochen';
  /** Heute (daily) bzw. diese Woche (weekly) bereits erfüllt? */
  doneNow: boolean;
  /** Fortschritt im aktuellen Zeitraum, z. B. 2 von 4 diese Woche. */
  periodCount: number;
  periodTarget: number;
};

/**
 * Serien. Der aktuelle Zeitraum (heute bzw. diese Woche) bricht die Serie nicht,
 * solange er noch nicht vorbei ist.
 */
export function streakInfo(h: HabitDef, values: HabitValues, today: string, sinceDay?: string): StreakInfo {
  const earliest = sinceDay ?? [...values.keys()].sort()[0] ?? today;
  if (h.frequency === 'daily' && h.kind !== 'workouts') {
    const doneNow = isDayDone(h, values.get(today));
    let current = 0;
    let d = doneNow ? today : addDays(today, -1);
    while (isDayDone(h, values.get(d))) {
      current += 1;
      d = addDays(d, -1);
    }
    let best = 0;
    let run = 0;
    for (let day = earliest; day <= today; day = addDays(day, 1)) {
      run = isDayDone(h, values.get(day)) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return { current, best: Math.max(best, current), unit: 'Tage', doneNow, periodCount: doneNow ? 1 : 0, periodTarget: 1 };
  }

  const target = weekTarget(h);
  const thisWeek = startOfWeek(dayToTime(today));
  const periodCount = weekCount(h, values, thisWeek);
  const doneNow = periodCount >= target;
  let current = 0;
  let w = doneNow ? thisWeek : addWeeks(thisWeek, -1);
  const firstWeek = startOfWeek(dayToTime(earliest));
  while (w >= firstWeek && weekCount(h, values, w) >= target) {
    current += 1;
    w = addWeeks(w, -1);
  }
  let best = 0;
  let run = 0;
  for (let wk = firstWeek; wk <= thisWeek; wk = addWeeks(wk, 1)) {
    run = weekCount(h, values, wk) >= target ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current), unit: 'Wochen', doneNow, periodCount, periodTarget: target };
}

/** Heatmap der letzten `weeks` Wochen: Spalten = Wochen (Mo–So), Intensität 0–1. */
export function heatmap(h: HabitDef, values: HabitValues, today: string, weeks: number): { day: string; level: number; future: boolean }[][] {
  const thisWeek = startOfWeek(dayToTime(today));
  const cols: { day: string; level: number; future: boolean }[][] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addWeeks(thisWeek, -i);
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(ws);
      date.setDate(date.getDate() + d);
      const day = dayKey(date);
      const v = values.get(day) ?? 0;
      let level = 0;
      if (h.kind === 'number') level = Math.min(1, v / Math.max(1e-9, h.dailyTarget ?? 1));
      else level = v > 0 ? 1 : 0;
      col.push({ day, level, future: day > today });
    }
    cols.push(col);
  }
  return cols;
}

/** Erfüllungsquote der letzten `days` Tage (daily) bzw. Wochen (weekly) in %. */
export function completionRate(h: HabitDef, values: HabitValues, today: string, periods: number): number {
  let ok = 0;
  if (h.frequency === 'daily' && h.kind !== 'workouts') {
    for (let i = 0; i < periods; i++) if (isDayDone(h, values.get(addDays(today, -i)))) ok += 1;
  } else {
    const thisWeek = startOfWeek(dayToTime(today));
    // Aktuelle (unfertige) Woche nicht mitzählen.
    for (let i = 1; i <= periods; i++) if (weekCount(h, values, addWeeks(thisWeek, -i)) >= weekTarget(h)) ok += 1;
  }
  return Math.round((ok / periods) * 100);
}
