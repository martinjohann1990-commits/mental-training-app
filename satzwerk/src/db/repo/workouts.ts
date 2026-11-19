import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import type { DraftExercise, SetValues, WorkoutDraft } from '@/domain/workout';
import { newKey, pruneDraft } from '@/domain/workout';
import { newId } from '@/lib/id';

import { db } from '../client';
import { workoutExercises, workouts, workoutSets, type WorkoutRow } from '../schema';

export type WorkoutMeta = { name: string; notes: string; rating: number | null; energy: number | null };

/** Speichert ein abgeschlossenes Workout (nur abgehakte Sätze). */
export async function saveWorkout(draft: WorkoutDraft, meta: WorkoutMeta, endedAt = Date.now()): Promise<string> {
  const pruned = pruneDraft(draft);
  const id = newId('wo_');
  await db.transaction(async (tx) => {
    await tx.insert(workouts).values({
      id,
      name: meta.name.trim() || draft.name || 'Workout',
      routineId: draft.routineId,
      startedAt: new Date(draft.startedAt),
      endedAt: new Date(endedAt),
      notes: meta.notes.trim(),
      rating: meta.rating,
      energy: meta.energy,
      createdAt: new Date(endedAt),
      updatedAt: new Date(endedAt),
    });
    for (const [pos, ex] of pruned.exercises.entries()) {
      const wexId = newId('we_');
      await tx.insert(workoutExercises).values({
        id: wexId,
        workoutId: id,
        exerciseId: ex.exerciseId,
        position: pos,
        supersetGroup: ex.supersetGroup,
        restSeconds: ex.restSeconds,
        note: ex.note,
        interval: ex.interval,
      });
      if (ex.sets.length > 0) {
        await tx.insert(workoutSets).values(
          ex.sets.map((s, i) => ({
            id: newId('ws_'),
            workoutExerciseId: wexId,
            position: i,
            type: s.type,
            weight: s.weight,
            reps: s.reps,
            repsRight: s.repsRight,
            duration: s.duration,
            distance: s.distance,
            rpe: s.rpe,
            note: s.note,
          })),
        );
      }
    }
  });
  return id;
}

/** Voll qualifiziert – Drizzle würde in Unterabfragen sonst nur `id` schreiben (mehrdeutig). */
const WORKOUT_ID = sql.raw('"workouts"."id"');

export type WorkoutListItem = WorkoutRow & { exerciseCount: number; setCount: number; volume: number };

/** Workouts mit Kennzahlen, neueste zuerst. */
export const recentWorkoutsQuery = (limit = 20) =>
  db
    .select({
      id: workouts.id,
      name: workouts.name,
      routineId: workouts.routineId,
      startedAt: workouts.startedAt,
      endedAt: workouts.endedAt,
      notes: workouts.notes,
      rating: workouts.rating,
      energy: workouts.energy,
      createdAt: workouts.createdAt,
      updatedAt: workouts.updatedAt,
      exerciseCount: sql<number>`(select count(*) from ${workoutExercises} we where we.workout_id = ${WORKOUT_ID})`,
      setCount: sql<number>`(select count(*) from ${workoutSets} ws join ${workoutExercises} we on ws.workout_exercise_id = we.id where we.workout_id = ${WORKOUT_ID})`,
      volume: sql<number>`(select coalesce(sum(case when ws.type != 'warmup' and ws.weight > 0 then ws.weight * (coalesce(ws.reps,0) + coalesce(ws.reps_right,0)) else 0 end), 0) from ${workoutSets} ws join ${workoutExercises} we on ws.workout_exercise_id = we.id where we.workout_id = ${WORKOUT_ID})`,
    })
    .from(workouts)
    .orderBy(desc(workouts.startedAt))
    .limit(limit);

export type WorkoutDetail = WorkoutRow & {
  exercises: (Omit<DraftExercise, 'key' | 'sets'> & {
    id: string;
    sets: (SetValues & { id: string; type: DraftExercise['sets'][number]['type']; rpe: number | null; note: string })[];
  })[];
};

export async function getWorkoutDetail(id: string): Promise<WorkoutDetail | null> {
  const [w] = await db.select().from(workouts).where(eq(workouts.id, id));
  if (!w) return null;
  const exs = await db.select().from(workoutExercises).where(eq(workoutExercises.workoutId, id)).orderBy(workoutExercises.position);
  const sets = exs.length
    ? await db
        .select()
        .from(workoutSets)
        .where(inArray(workoutSets.workoutExerciseId, exs.map((e) => e.id)))
        .orderBy(workoutSets.position)
    : [];
  return {
    ...w,
    exercises: exs.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      supersetGroup: e.supersetGroup,
      restSeconds: e.restSeconds,
      note: e.note,
      interval: e.interval ?? null,
      sets: sets
        .filter((s) => s.workoutExerciseId === e.id)
        .map((s) => ({
          id: s.id,
          type: s.type,
          weight: s.weight,
          reps: s.reps,
          repsRight: s.repsRight,
          duration: s.duration,
          distance: s.distance,
          rpe: s.rpe,
          note: s.note,
        })),
    })),
  };
}

/** Workout → Übungsliste für „Wiederholen“ (Werte als Vorgabe, nichts abgehakt). */
export function detailToDraftExercises(d: WorkoutDetail): DraftExercise[] {
  return d.exercises.map((e) => ({
    key: newKey(),
    exerciseId: e.exerciseId,
    supersetGroup: e.supersetGroup,
    restSeconds: e.restSeconds,
    note: e.note,
    interval: e.interval,
    sets: e.sets.map((s) => ({
      key: newKey(),
      type: s.type,
      weight: s.weight,
      reps: s.reps,
      repsRight: s.repsRight,
      duration: s.duration,
      distance: s.distance,
      rpe: null,
      note: '',
      completed: false,
    })),
  }));
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.delete(workouts).where(eq(workouts.id, id));
}

/**
 * Sätze vom jeweils letzten Workout pro Übung („Vorher“-Spalte).
 * Liefert Map exerciseId → Arbeitssätze in Reihenfolge.
 */
export async function previousSetsFor(exerciseIds: string[], excludeWorkoutId?: string): Promise<Record<string, SetValues[]>> {
  const ids = [...new Set(exerciseIds)];
  if (ids.length === 0) return {};
  const rows = await db
    .select({
      exerciseId: workoutExercises.exerciseId,
      wexId: workoutExercises.id,
      startedAt: workouts.startedAt,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      repsRight: workoutSets.repsRight,
      duration: workoutSets.duration,
      distance: workoutSets.distance,
      position: workoutSets.position,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutSets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(
      and(
        inArray(workoutExercises.exerciseId, ids),
        excludeWorkoutId ? sql`${workouts.id} != ${excludeWorkoutId}` : undefined,
      ),
    )
    .orderBy(desc(workouts.startedAt), workoutExercises.position, workoutSets.position);

  const result: Record<string, SetValues[]> = {};
  const chosen: Record<string, string> = {};
  for (const r of rows) {
    // Erste (= neueste) Workout-Übung pro exerciseId gewinnt.
    if (!chosen[r.exerciseId]) chosen[r.exerciseId] = r.wexId;
    if (chosen[r.exerciseId] !== r.wexId) continue;
    (result[r.exerciseId] ??= []).push({
      weight: r.weight,
      reps: r.reps,
      repsRight: r.repsRight,
      duration: r.duration,
      distance: r.distance,
    });
  }
  return result;
}
