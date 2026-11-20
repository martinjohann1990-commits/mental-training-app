import { completionRate, heatmap, isDayDone, streakInfo, weekCount } from '@/domain/habits';
import { dayToTime } from '@/domain/body';
import { startOfWeek } from '@/domain/stats';

const daily = { kind: 'check' as const, dailyTarget: null, frequency: 'daily' as const, timesPerWeek: null };
const water = { kind: 'number' as const, dailyTarget: 3, frequency: 'daily' as const, timesPerWeek: null };
const gym = { kind: 'workouts' as const, dailyTarget: null, frequency: 'weekly' as const, timesPerWeek: 3 };
const vals = (o: Record<string, number>) => new Map(Object.entries(o));

describe('Gewohnheiten', () => {
  it('isDayDone: Ja/Nein und Zahl mit Tagesziel', () => {
    expect(isDayDone(daily, 1)).toBe(true);
    expect(isDayDone(daily, undefined)).toBe(false);
    expect(isDayDone(water, 2.5)).toBe(false);
    expect(isDayDone(water, 3)).toBe(true);
  });

  it('tägliche Serie: heute offen bricht die Serie nicht', () => {
    // 2026-11-20 = Freitag
    const v = vals({ '2026-11-17': 1, '2026-11-18': 1, '2026-11-19': 1, '2026-11-14': 1, '2026-11-15': 1, '2026-11-16': 0 });
    const s = streakInfo(daily, v, '2026-11-20');
    expect(s).toMatchObject({ current: 3, doneNow: false, unit: 'Tage' });
    expect(s.best).toBe(3);
    v.set('2026-11-20', 1);
    expect(streakInfo(daily, v, '2026-11-20').current).toBe(4);
  });

  it('Lücke bricht die Serie', () => {
    const v = vals({ '2026-11-17': 1, '2026-11-18': 1 });
    expect(streakInfo(daily, v, '2026-11-20').current).toBe(0);
    expect(streakInfo(daily, v, '2026-11-20').best).toBe(2);
  });

  it('wöchentliches Trainingsziel aus Workouts', () => {
    const v = vals({
      '2026-11-03': 1, '2026-11-05': 1, '2026-11-07': 1, // KW 45: 3
      '2026-11-10': 2, '2026-11-14': 1, // KW 46: 3
      '2026-11-17': 1, // KW 47 (aktuell): 1
    });
    expect(weekCount(gym, v, startOfWeek(dayToTime('2026-11-10')))).toBe(3);
    const s = streakInfo(gym, v, '2026-11-20');
    expect(s).toMatchObject({ current: 2, unit: 'Wochen', doneNow: false, periodCount: 1, periodTarget: 3 });
  });

  it('Heatmap: 7 Tage pro Spalte, Zahl anteilig, Zukunft markiert', () => {
    const cols = heatmap(water, vals({ '2026-11-19': 1.5 }), '2026-11-20', 2);
    expect(cols).toHaveLength(2);
    expect(cols[1]).toHaveLength(7);
    expect(cols[1].find((c) => c.day === '2026-11-19')?.level).toBe(0.5);
    expect(cols[1].find((c) => c.day === '2026-11-22')?.future).toBe(true);
  });

  it('Erfüllungsquote', () => {
    expect(completionRate(daily, vals({ '2026-11-20': 1, '2026-11-19': 1 }), '2026-11-20', 4)).toBe(50);
  });
});
