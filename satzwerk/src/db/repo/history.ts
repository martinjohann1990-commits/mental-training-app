import { asc, eq } from 'drizzle-orm';

import type { HistorySet, WorkoutMetaLite } from '@/domain/stats';

import { db } from '../client';
import { workoutExercises, workouts, workoutSets } from '../schema';

export type HistoryData = { sets: HistorySet[]; workouts: WorkoutMetaLite[] };

/** Lädt alle gespeicherten Sätze flach (für Statistiken) plus Workout-Metadaten. */
export async function loadHistory(): Promise<HistoryData> {
  const rows = await db
    .select({
      workoutId: workouts.id,
      startedAt: workouts.startedAt,
      endedAt: workouts.endedAt,
      exerciseId: workoutExercises.exerciseId,
      type: workoutSets.type,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      repsRight: workoutSets.repsRight,
      duration: workoutSets.duration,
      distance: workoutSets.distance,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutSets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .orderBy(asc(workouts.startedAt), asc(workoutExercises.position), asc(workoutSets.position));

  const ws = await db
    .select({
      id: workouts.id,
      name: workouts.name,
      startedAt: workouts.startedAt,
      endedAt: workouts.endedAt,
      rating: workouts.rating,
      energy: workouts.energy,
    })
    .from(workouts)
    .orderBy(asc(workouts.startedAt));

  return {
    sets: rows.map((r) => ({ ...r, startedAt: r.startedAt.getTime(), endedAt: r.endedAt.getTime() })),
    workouts: ws.map((w) => ({ ...w, startedAt: w.startedAt.getTime(), endedAt: w.endedAt.getTime() })),
  };
}
