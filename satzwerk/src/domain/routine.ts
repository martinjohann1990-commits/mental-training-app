import { emptySet, type DraftExercise, newKey, normalizeGroups, type SetValues } from './workout';

/** Struktur, wie sie in der Routine gespeichert wird (identisch zu db/schema RoutineExercise). */
export type RoutineExerciseData = {
  exerciseId: string;
  supersetGroup: number | null;
  restSeconds: number;
  note: string;
  interval: DraftExercise['interval'];
  sets: (SetValues & { type: DraftExercise['sets'][number]['type'] })[];
};

/** Routine → Entwurf (Werte als Vorgabe eingetragen, nichts abgehakt). */
export function routineToDraftExercises(exercises: RoutineExerciseData[]): DraftExercise[] {
  return normalizeGroups(
    exercises.map((e) => ({
      key: newKey(),
      exerciseId: e.exerciseId,
      supersetGroup: e.supersetGroup,
      restSeconds: e.restSeconds,
      note: e.note,
      interval: e.interval,
      sets: (e.sets.length > 0 ? e.sets : [{ ...emptySet() }]).map((s) => ({
        ...emptySet(s.type),
        weight: s.weight,
        reps: s.reps,
        repsRight: s.repsRight,
        duration: s.duration,
        distance: s.distance,
      })),
    })),
  );
}

/** Entwurf → Routine. `onlyCompleted` für „Workout als Routine speichern“. */
export function draftToRoutineExercises(exercises: DraftExercise[], onlyCompleted = false): RoutineExerciseData[] {
  return normalizeGroups(exercises)
    .map((e) => ({
      exerciseId: e.exerciseId,
      supersetGroup: e.supersetGroup,
      restSeconds: e.restSeconds,
      note: e.note,
      interval: e.interval,
      sets: e.sets
        .filter((s) => !onlyCompleted || s.completed)
        .map((s) => ({
          type: s.type,
          weight: s.weight,
          reps: s.reps,
          repsRight: s.repsRight,
          duration: s.duration,
          distance: s.distance,
        })),
    }))
    .filter((e) => e.sets.length > 0 || !onlyCompleted);
}
