import {
  addExercises, addSet, applyIntervalResult, moveExercise, patchSet, removeExercise, toggleSetComplete,
} from '@/domain/draft-ops';
import { draftToRoutineExercises, routineToDraftExercises } from '@/domain/routine';
import { toggleSupersetWithNext } from '@/domain/workout';

describe('draft-ops', () => {
  const base = () => addExercises([], ['bench', 'row', 'curl']);

  it('addSet übernimmt Werte des letzten Satzes', () => {
    let l = base();
    const [ex] = l;
    l = patchSet(l, ex.key, ex.sets[0].key, { weight: 80, reps: 8 });
    l = addSet(l, ex.key);
    expect(l[0].sets[1]).toMatchObject({ weight: 80, reps: 8, completed: false });
  });

  it('Abhaken übernimmt leere Felder aus „letztes Mal“', () => {
    const l = base();
    const ex = l[0];
    const r = toggleSetComplete(l, ex.key, ex.sets[0].key, 'weight_reps', {
      weight: 70, reps: 10, repsRight: null, duration: null, distance: null,
    });
    expect(r![0].sets[0]).toMatchObject({ weight: 70, reps: 10, completed: true });
    // und wieder aufhaken
    const r2 = toggleSetComplete(r!, ex.key, ex.sets[0].key, 'weight_reps', null);
    expect(r2![0].sets[0].completed).toBe(false);
  });

  it('Abhaken ohne Werte schlägt fehl (null)', () => {
    const l = base();
    expect(toggleSetComplete(l, l[0].key, l[0].sets[0].key, 'weight_reps', null)).toBeNull();
  });

  it('Verschieben/Entfernen löst kaputte Supersätze auf', () => {
    let l = toggleSupersetWithNext(base(), 0); // bench+row
    expect(l.map((e) => e.supersetGroup)).toEqual([1, 1, null]);
    l = removeExercise(l, l[1].key);
    expect(l.map((e) => e.supersetGroup)).toEqual([null, null]);
    expect(moveExercise(l, l[0].key, 1).map((e) => e.exerciseId)).toEqual(['curl', 'bench']);
    expect(moveExercise(l, l[0].key, -1)).toBe(l);
  });

  it('EMOM-Ergebnis erzeugt einen Satz pro Minute', () => {
    const l = base();
    const r = applyIntervalResult(l, l[0].key, { mode: 'emom', minutes: 5, repsPerMinute: 6 }, { totalReps: null });
    expect(r[0].sets).toHaveLength(5);
    expect(r[0].sets.every((s) => s.completed && s.reps === 6)).toBe(true);
  });

  it('Tabata verteilt Gesamt-Wdh. auf Runden', () => {
    const l = base();
    const r = applyIntervalResult(l, l[0].key, { mode: 'tabata', workSeconds: 20, restSeconds: 10, rounds: 4 }, { totalReps: 10 });
    expect(r[0].sets.map((s) => s.reps)).toEqual([3, 3, 2, 2]);
  });
});

describe('Routine ↔ Entwurf', () => {
  it('Round-Trip erhält Vorgaben und Supersätze', () => {
    const routine = [
      { exerciseId: 'a', supersetGroup: 1, restSeconds: 60, note: 'n', interval: null,
        sets: [{ type: 'warmup' as const, weight: 40, reps: 10, repsRight: null, duration: null, distance: null }] },
      { exerciseId: 'b', supersetGroup: 1, restSeconds: 60, note: '', interval: null, sets: [] },
    ];
    const draft = routineToDraftExercises(routine);
    expect(draft[1].sets).toHaveLength(1);
    expect(draft[0].sets[0]).toMatchObject({ type: 'warmup', weight: 40, reps: 10, completed: false });
    const back = draftToRoutineExercises(draft);
    expect(back[0]).toEqual(routine[0]);
    expect(back[1].supersetGroup).toBe(1);
  });
  it('„Als Routine speichern“ übernimmt nur abgehakte Sätze', () => {
    const draft = routineToDraftExercises([
      { exerciseId: 'a', supersetGroup: null, restSeconds: 90, note: '', interval: null,
        sets: [{ type: 'normal', weight: 50, reps: 5, repsRight: null, duration: null, distance: null }] },
    ]);
    expect(draftToRoutineExercises(draft, true)).toEqual([]);
  });
});
