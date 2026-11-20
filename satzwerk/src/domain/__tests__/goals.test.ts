import { evaluateGoal, forecastGoal, goalProgress, isReached, linearFit, requiredPerWeek, strengthPoints } from '@/domain/goals';

const DAY = 86_400_000;
const now = new Date(2026, 10, 20).getTime();

describe('Ziele', () => {
  it('Fortschritt in beide Richtungen', () => {
    expect(goalProgress(80, 100, 90)).toBe(0.5);
    expect(goalProgress(90, 80, 85)).toBe(0.5); // abnehmen
    expect(goalProgress(90, 80, 92)).toBe(0); // falsche Richtung → 0
    expect(goalProgress(80, 100, 120)).toBe(1);
    expect(goalProgress(80, 100, null)).toBe(0);
  });
  it('isReached', () => {
    expect(isReached(90, 80, 79.9)).toBe(true);
    expect(isReached(80, 100, 99)).toBe(false);
  });
  it('linearFit', () => {
    const f = linearFit([{ t: 0, value: 1 }, { t: 10, value: 21 }])!;
    expect(f.slope).toBe(2);
    expect(f.intercept).toBe(1);
  });
  it('Prognose: Abnehmen 0,5 kg/Woche → Datum', () => {
    const pts = [0, 7, 14, 21].map((d, i) => ({ t: now - (21 - d) * DAY, value: 86 - i * 0.5 }));
    const f = forecastGoal(86, 80, 84.5, pts, now, now + 60 * DAY);
    expect(f.kind).toBe('date');
    if (f.kind === 'date') {
      // 4,5 kg bei 0,5 kg/Woche ≈ 9 Wochen
      expect(Math.round((f.date - now) / (7 * DAY))).toBe(9);
      expect(f.onTrack).toBe(false);
    }
  });
  it('Prognose: falsche Richtung, zu wenig Daten, erreicht', () => {
    const pts = [{ t: now - 14 * DAY, value: 80 }, { t: now, value: 81 }];
    expect(forecastGoal(82, 78, 81, pts, now, null).kind).toBe('away');
    expect(forecastGoal(82, 78, 81, [pts[1]], now, null).kind).toBe('unknown');
    expect(forecastGoal(82, 78, 77, pts, now, null).kind).toBe('reached');
  });
  it('requiredPerWeek', () => {
    expect(requiredPerWeek(100, 90, now, now + 10 * 7 * DAY)).toBeCloseTo(1);
    expect(requiredPerWeek(100, 90, now, null)).toBeNull();
  });
});


describe('evaluateGoal', () => {
  const h = (workoutId: string, daysAgo: number, weight: number, reps: number) => ({
    workoutId, startedAt: now - daysAgo * DAY, endedAt: now - daysAgo * DAY, exerciseId: 'bench', type: 'normal' as const,
    weight, reps, repsRight: null, duration: null, distance: null,
  });
  const history = [h('a', 20, 80, 5), h('a', 20, 85, 2), h('b', 10, 85, 5), h('c', 1, 90, 3)];
  const ctx = { history, measurements: [], habitStreaks: new Map(), now };

  it('Gewicht bei mindestens X Wdh.', () => {
    expect(strengthPoints(history, 'bench', 'weight', 5).map((p) => p.value)).toEqual([80, 85]);
    const e = evaluateGoal({ type: 'strength', refId: 'bench', metric: 'weight', targetReps: 5, startValue: 80, targetValue: 100, deadline: null }, ctx);
    expect(e.current).toBe(85);
    expect(e.progress).toBe(0.25);
  });
  it('1RM-Ziel nutzt bestes geschätztes 1RM', () => {
    const e = evaluateGoal({ type: 'strength', refId: 'bench', metric: 'e1rm', targetReps: null, startValue: 90, targetValue: 110, deadline: null }, ctx);
    expect(e.current).toBe(99.2); // 85 × (1 + 5/30)
  });
  it('Körpergewicht abnehmen mit Prognose', () => {
    const measurements = [
      { day: '2026-10-30', key: 'weight', value: 86 },
      { day: '2026-11-06', key: 'weight', value: 85.5 },
      { day: '2026-11-13', key: 'weight', value: 85 },
      { day: '2026-11-20', key: 'weight', value: 84.5 },
    ];
    const e = evaluateGoal({ type: 'bodyweight', refId: 'weight', metric: null, targetReps: null, startValue: 86, targetValue: 80, deadline: null }, { ...ctx, measurements });
    expect(e.current).toBe(84.5);
    expect(e.progress).toBe(0.25);
    expect(e.forecast.kind).toBe('date');
  });
  it('Gewohnheitsziel: Serie, Prognose in Tagen', () => {
    const e = evaluateGoal(
      { type: 'habit', refId: 'h1', metric: null, targetReps: null, startValue: 0, targetValue: 30, deadline: null },
      { ...ctx, habitStreaks: new Map([['h1', { current: 12, unit: 'Tage' as const }]]) },
    );
    expect(e.current).toBe(12);
    expect(e.forecast).toMatchObject({ kind: 'date' });
    if (e.forecast.kind === 'date') expect(Math.round((e.forecast.date - now) / DAY)).toBe(18);
  });
});
