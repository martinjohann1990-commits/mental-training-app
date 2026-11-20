/**
 * Ziele: Fortschritt und Prognose. Rein und testbar.
 */
import { dayToTime, type MeasureEntry } from './body';
import { estimate1RM, type HistorySet } from './stats';

export type GoalType = 'strength' | 'bodyweight' | 'measurement' | 'habit';

export type GoalPoint = { t: number; value: number };

/** Fortschritt 0–1 zwischen Start und Ziel – funktioniert in beide Richtungen (z. B. abnehmen). */
export function goalProgress(start: number, target: number, current: number | null): number {
  if (current === null) return 0;
  if (target === start) return current === target ? 1 : 0;
  const p = (current - start) / (target - start);
  return Math.max(0, Math.min(1, p));
}

export function isReached(start: number, target: number, current: number | null): boolean {
  if (current === null) return false;
  return target >= start ? current >= target : current <= target;
}

/** Lineare Regression (kleinste Quadrate): Steigung pro Millisekunde und Achsenabschnitt. */
export function linearFit(points: GoalPoint[]): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.t, 0) / n;
  const my = points.reduce((a, p) => a + p.value, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mx) * (p.value - my);
    den += (p.t - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

export type Forecast =
  | { kind: 'reached' }
  | { kind: 'date'; date: number; onTrack: boolean | null }
  | { kind: 'away' }
  | { kind: 'unknown' };

const DAY = 86_400_000;

/**
 * Prognose: Wann wird das Ziel beim aktuellen Tempo erreicht?
 * Nutzt die Punkte der letzten 8 Wochen (mind. 2 Punkte, mind. 3 Tage Abstand).
 */
export function forecastGoal(
  start: number,
  target: number,
  current: number | null,
  points: GoalPoint[],
  now: number,
  deadline: number | null,
): Forecast {
  if (isReached(start, target, current)) return { kind: 'reached' };
  const recent = points.filter((p) => p.t >= now - 56 * DAY).sort((a, b) => a.t - b.t);
  if (recent.length < 2 || recent[recent.length - 1].t - recent[0].t < 3 * DAY) return { kind: 'unknown' };
  const fit = linearFit(recent);
  if (!fit) return { kind: 'unknown' };
  const up = target > start;
  if ((up && fit.slope <= 0) || (!up && fit.slope >= 0)) return { kind: 'away' };
  const date = (target - fit.intercept) / fit.slope;
  // Unrealistisch weit weg (> 5 Jahre) als „nicht absehbar“ behandeln.
  if (date - now > 5 * 365 * DAY) return { kind: 'away' };
  const when = Math.max(now, date);
  return { kind: 'date', date: when, onTrack: deadline ? when <= deadline : null };
}

/** Benötigtes Tempo pro Woche, um die Deadline zu schaffen. */
export function requiredPerWeek(target: number, current: number | null, now: number, deadline: number | null): number | null {
  if (current === null || deadline === null || deadline <= now) return null;
  const weeks = (deadline - now) / (7 * DAY);
  return (target - current) / weeks;
}

// ── Auswertung eines Ziels gegen die vorhandenen Daten ─────────────────


export type GoalDef = {
  type: GoalType;
  refId: string | null;
  metric: string | null;
  targetReps: number | null;
  startValue: number;
  targetValue: number;
  deadline: string | null;
};

export type GoalContext = {
  history: HistorySet[];
  measurements: MeasureEntry[];
  /** Aktuelle Serie je Gewohnheits-ID. */
  habitStreaks: Map<string, { current: number; unit: 'Tage' | 'Wochen' }>;
  now: number;
};

export type GoalEvaluation = {
  current: number | null;
  points: GoalPoint[];
  progress: number;
  reached: boolean;
  forecast: Forecast;
};

/** Pro Workout den besten Wert (1RM bzw. Gewicht bei ≥ targetReps) einer Übung. */
export function strengthPoints(history: HistorySet[], exerciseId: string, metric: string | null, targetReps: number | null): GoalPoint[] {
  const best = new Map<string, GoalPoint>();
  for (const s of history) {
    if (s.exerciseId !== exerciseId || s.type === 'warmup') continue;
    let v: number | null = null;
    if (metric === 'weight') {
      if ((s.reps ?? 0) >= (targetReps ?? 1) && (s.weight ?? 0) > 0) v = s.weight;
    } else {
      v = estimate1RM(s.weight, s.reps);
    }
    if (v === null) continue;
    const prev = best.get(s.workoutId);
    if (!prev || v > prev.value) best.set(s.workoutId, { t: s.startedAt, value: v });
  }
  return [...best.values()].sort((a, b) => a.t - b.t);
}

export function evaluateGoal(g: GoalDef, ctx: GoalContext): GoalEvaluation {
  let current: number | null = null;
  let points: GoalPoint[] = [];
  const deadline = g.deadline ? dayToTime(g.deadline) : null;

  if (g.type === 'strength' && g.refId) {
    points = strengthPoints(ctx.history, g.refId, g.metric, g.targetReps);
    current = points.length ? Math.max(...points.map((p) => p.value)) : null;
  } else if ((g.type === 'bodyweight' || g.type === 'measurement') && g.refId) {
    points = ctx.measurements
      .filter((e) => e.key === g.refId)
      .map((e) => ({ t: dayToTime(e.day), value: e.value }))
      .sort((a, b) => a.t - b.t);
    current = points.length ? points[points.length - 1].value : null;
  } else if (g.type === 'habit' && g.refId) {
    const s = ctx.habitStreaks.get(g.refId);
    current = s ? s.current : 0;
  }

  const reached = isReached(g.startValue, g.targetValue, current);
  let forecast: Forecast;
  if (g.type === 'habit') {
    if (reached) forecast = { kind: 'reached' };
    else {
      const unit = ctx.habitStreaks.get(g.refId ?? '')?.unit ?? 'Tage';
      const remaining = g.targetValue - (current ?? 0);
      const date = ctx.now + remaining * (unit === 'Wochen' ? 7 : 1) * DAY;
      forecast = { kind: 'date', date, onTrack: deadline ? date <= deadline : null };
    }
  } else {
    forecast = forecastGoal(g.startValue, g.targetValue, current, points, ctx.now, deadline);
  }
  return { current, points, progress: goalProgress(g.startValue, g.targetValue, current), reached, forecast };
}
