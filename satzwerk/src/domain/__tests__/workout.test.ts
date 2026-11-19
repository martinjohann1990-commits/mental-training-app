import {
  type DraftExercise,
  emptySet,
  hasValues,
  nextSetType,
  normalizeGroups,
  pruneDraft,
  restAfterSet,
  toggleSupersetWithNext,
  workoutSummary,
} from '@/domain/workout';

const ex = (key: string, group: number | null = null, rest = 90): DraftExercise => ({
  key, exerciseId: key, supersetGroup: group, restSeconds: rest, note: '', interval: null, sets: [],
});
const groups = (l: DraftExercise[]) => l.map((e) => e.supersetGroup);

describe('Satztypen', () => {
  it('rotiert Normal → Aufwärmen → Drop → Versagen → Normal', () => {
    expect(nextSetType('normal')).toBe('warmup');
    expect(nextSetType('failure')).toBe('normal');
  });
});

describe('restAfterSet', () => {
  it('ohne Supersatz: eigene Pause', () => {
    expect(restAfterSet([ex('a', null, 120)], 0)).toBe(120);
  });
  it('im Supersatz: keine Pause bis zur letzten Übung der Runde', () => {
    const l = [ex('a', 1, 60), ex('b', 1, 75), ex('c')];
    expect(restAfterSet(l, 0)).toBe(0);
    expect(restAfterSet(l, 1)).toBe(75);
    expect(restAfterSet(l, 2)).toBe(90);
  });
});

describe('toggleSupersetWithNext', () => {
  it('verknüpft zwei Übungen', () => {
    expect(groups(toggleSupersetWithNext([ex('a'), ex('b'), ex('c')], 0))).toEqual([1, 1, null]);
  });
  it('erweitert einen Supersatz zum Zirkel', () => {
    const l = toggleSupersetWithNext([ex('a', 1), ex('b', 1), ex('c')], 1);
    expect(groups(l)).toEqual([1, 1, 1]);
  });
  it('verbindet zwei Gruppen', () => {
    const l = toggleSupersetWithNext([ex('a', 1), ex('b', 1), ex('c', 2), ex('d', 2)], 1);
    expect(groups(l)).toEqual([1, 1, 1, 1]);
  });
  it('trennt einen Zirkel in der Mitte', () => {
    const l = toggleSupersetWithNext([ex('a', 1), ex('b', 1), ex('c', 1), ex('d', 1)], 1);
    expect(groups(l)).toEqual([1, 1, 2, 2]);
  });
  it('löst Einzelgruppen auf', () => {
    expect(groups(toggleSupersetWithNext([ex('a', 1), ex('b', 1)], 0))).toEqual([null, null]);
    expect(groups(normalizeGroups([ex('a', 5), ex('b', 7), ex('c', 7)]))).toEqual([null, 1, 1]);
  });
});

describe('Zusammenfassung & Speichern', () => {
  const s = (over: Partial<ReturnType<typeof emptySet>>) => ({ ...emptySet(), ...over });
  const draft = {
    name: 'X', routineId: null, startedAt: 0, rest: null,
    exercises: [
      { ...ex('a'), sets: [s({ weight: 100, reps: 5, completed: true }), s({ type: 'warmup' as const, weight: 60, reps: 10, completed: true }), s({ weight: 100, reps: 5 })] },
      { ...ex('b'), sets: [s({ weight: 16, reps: 10, repsRight: 8, completed: true })] },
      { ...ex('c'), sets: [s({ reps: 10 })] },
    ],
  };
  it('zählt nur abgehakte Sätze, Volumen ohne Aufwärmsätze, L+R addiert', () => {
    expect(workoutSummary(draft)).toEqual({ exercises: 2, sets: 3, volume: 500 + 16 * 18 });
  });
  it('pruneDraft entfernt offene Sätze und leere Übungen', () => {
    const p = pruneDraft(draft);
    expect(p.exercises.map((e) => e.key)).toEqual(['a', 'b']);
    expect(p.exercises[0].sets).toHaveLength(2);
  });
  it('hasValues verlangt mehr als nur Gewicht', () => {
    expect(hasValues({ weight: 20, reps: null, repsRight: null, duration: null, distance: null }, 'weight_reps')).toBe(false);
    expect(hasValues({ weight: null, reps: null, repsRight: null, duration: 30, distance: null }, 'duration')).toBe(true);
  });
});
