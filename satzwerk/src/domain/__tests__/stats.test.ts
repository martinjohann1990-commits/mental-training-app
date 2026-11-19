import {
  estimate1RM, exerciseSessions, type HistorySet, muscleDistribution, percentChange, personalRecords,
  prsInWorkout, startOfWeek, summarizePeriod, weeklyBuckets, weekStreak,
} from '@/domain/stats';

const day = (d: string) => new Date(`${d}T10:00:00`).getTime();
let n = 0;
const set = (workoutId: string, date: string, exerciseId: string, weight: number | null, reps: number | null, extra: Partial<HistorySet> = {}): HistorySet => ({
  workoutId, startedAt: day(date), endedAt: day(date) + 3600_000, exerciseId, type: 'normal',
  weight, reps, repsRight: null, duration: null, distance: null, ...extra, ...(n++ < 0 ? {} : {}),
});

const history: HistorySet[] = [
  set('w1', '2026-11-02', 'bench', 40, 10, { type: 'warmup' }),
  set('w1', '2026-11-02', 'bench', 80, 5),
  set('w1', '2026-11-02', 'bench', 80, 5),
  set('w1', '2026-11-02', 'swing', 24, 15),
  set('w2', '2026-11-09', 'bench', 85, 3),
  set('w2', '2026-11-09', 'bench', 75, 8),
  set('w3', '2026-11-16', 'bench', 82.5, 5),
  set('w3', '2026-11-16', 'plank', null, null, { duration: 90 }),
];

describe('estimate1RM', () => {
  it('Epley, 1 Wdh. = Gewicht, >12 Wdh. = null', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 5)).toBe(116.7);
    expect(estimate1RM(100, 15)).toBeNull();
    expect(estimate1RM(null, 5)).toBeNull();
  });
});

describe('exerciseSessions & PRs', () => {
  const sessions = exerciseSessions(history, 'bench');
  it('eine Session pro Workout, Aufwärmsätze ignoriert', () => {
    expect(sessions.map((s) => s.workoutId)).toEqual(['w1', 'w2', 'w3']);
    expect(sessions[0]).toMatchObject({ sets: 2, maxWeight: 80, volume: 800, best1RM: 93.3 });
    expect(sessions[1]).toMatchObject({ maxWeight: 85, volume: 255 + 600, best1RM: 95 });
  });
  it('Bestwerte', () => {
    const prs = personalRecords(sessions);
    expect(prs.find((p) => p.kind === 'weight')).toMatchObject({ value: 85, workoutId: 'w2' });
    expect(prs.find((p) => p.kind === 'volume')).toMatchObject({ value: 855, workoutId: 'w2' });
  });
  it('neue Rekorde je Workout, erste Session zählt nicht', () => {
    expect(prsInWorkout(history, 'w1')).toEqual([]);
    const w2 = prsInWorkout(history, 'w2').map((p) => p.kind).sort();
    expect(w2).toEqual(['e1rm', 'reps', 'volume', 'weight']);
    // 82,5 × 5 → 1RM 96,3 schlägt 95 aus w2 – Gewicht (85) aber nicht.
    expect(prsInWorkout(history, 'w3')).toEqual([{ exerciseId: 'bench', kind: 'e1rm', value: 96.3 }]);
  });
});

describe('Zeiträume', () => {
  it('Woche beginnt Montag', () => {
    expect(new Date(startOfWeek(day('2026-11-19'))).getDay()).toBe(1);
    expect(new Date(startOfWeek(day('2026-11-16'))).getDate()).toBe(16);
  });
  it('weeklyBuckets', () => {
    const b = weeklyBuckets(history, day('2026-11-19'), 4);
    expect(b).toHaveLength(4);
    expect(b.map((x) => x.workouts)).toEqual([0, 1, 1, 1]);
    expect(b[1].volume).toBe(800 + 360);
    expect(b[1].sets).toBe(3);
  });
  it('Muskelverteilung: Haupt 1, sekundär 0,5', () => {
    const d = muscleDistribution(history, (id) =>
      id === 'bench' ? { primary: 'chest', secondary: ['triceps'] } : id === 'swing' ? { primary: 'glutes', secondary: [] } : undefined,
    );
    expect(d[0]).toEqual({ muscle: 'chest', sets: 5 });
    expect(d.find((x) => x.muscle === 'triceps')?.sets).toBe(2.5);
  });
  it('summarizePeriod', () => {
    const workouts = [
      { id: 'w1', name: 'A', startedAt: day('2026-11-02'), endedAt: day('2026-11-02') + 3600_000, rating: 4, energy: 3 },
      { id: 'w2', name: 'B', startedAt: day('2026-11-09'), endedAt: day('2026-11-09') + 1800_000, rating: 5, energy: null },
    ];
    const s = summarizePeriod(history, workouts, day('2026-11-01'), day('2026-11-15'));
    expect(s).toMatchObject({ workouts: 2, durationSec: 5400, trainingDays: 2, avgRating: 4.5, avgEnergy: 3 });
    expect(s.topExercises[0]).toEqual({ exerciseId: 'bench', sets: 4 });
    expect(s.prs.length).toBe(4);
  });
  it('percentChange & weekStreak', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(5, 0)).toBeNull();
    const starts = [day('2026-11-02'), day('2026-11-09'), day('2026-11-16')];
    expect(weekStreak(starts, day('2026-11-19'))).toBe(3);
    expect(weekStreak(starts, day('2026-11-24'))).toBe(3);
    expect(weekStreak(starts, day('2026-12-01'))).toBe(0);
  });
});
