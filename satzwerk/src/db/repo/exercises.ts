import { asc, eq } from 'drizzle-orm';

import type { EquipmentRef, LoggingType, Muscle } from '@/domain/catalog';
import { newId } from '@/lib/id';
import { deletePhotoFile } from '@/lib/photo-storage';

import { db } from '../client';
import { exercises } from '../schema';

export type ExerciseInput = {
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: EquipmentRef[];
  loggingType: LoggingType;
  instructions: string;
  complexParts: string[] | null;
};

export function validateExerciseInput(input: ExerciseInput): string | null {
  if (!input.name.trim()) return 'Bitte einen Namen eingeben.';
  if (input.name.trim().length > 80) return 'Der Name darf höchstens 80 Zeichen lang sein.';
  if (input.complexParts && input.complexParts.length === 1) {
    return 'Ein Komplex braucht mindestens zwei Bewegungen.';
  }
  return null;
}

/** Abfrage aller aktiven Übungen – als Live-Query nutzbar. */
export const allExercisesQuery = () =>
  db.select().from(exercises).where(eq(exercises.archived, false)).orderBy(asc(exercises.name));

export const exerciseByIdQuery = (id: string) => db.select().from(exercises).where(eq(exercises.id, id));

function clean(input: ExerciseInput) {
  return {
    ...input,
    name: input.name.trim(),
    instructions: input.instructions.trim(),
    secondaryMuscles: input.secondaryMuscles.filter((m) => m !== input.primaryMuscle),
    equipment: input.equipment.filter((e) => e !== 'bodyweight'),
    complexParts: input.complexParts && input.complexParts.length >= 2 ? input.complexParts : null,
  };
}

export async function createCustomExercise(input: ExerciseInput): Promise<string> {
  const id = newId('custom_');
  const now = new Date();
  await db.insert(exercises).values({ id, ...clean(input), isCustom: true, createdAt: now, updatedAt: now });
  return id;
}

export async function updateCustomExercise(id: string, input: ExerciseInput): Promise<void> {
  await db.update(exercises).set({ ...clean(input), updatedAt: new Date() }).where(eq(exercises.id, id));
}

/**
 * Eigene Übungen werden archiviert statt gelöscht, damit spätere Workouts
 * (Phase 2) ihre Referenz behalten.
 */
export async function archiveExercise(id: string): Promise<void> {
  await db.update(exercises).set({ archived: true, updatedAt: new Date() }).where(eq(exercises.id, id));
}

/** Alle Übungen inkl. archivierter – für Anzeige in Verlauf und Routinen. */
export const allExercisesWithArchivedQuery = () => db.select().from(exercises);

/** Setzt bzw. entfernt das eigene Foto/Video einer Übung (alte Datei wird gelöscht). */
export async function setExerciseMedia(id: string, mediaUri: string | null): Promise<void> {
  const [ex] = await db.select({ mediaUri: exercises.mediaUri }).from(exercises).where(eq(exercises.id, id));
  await db.update(exercises).set({ mediaUri, updatedAt: new Date() }).where(eq(exercises.id, id));
  if (ex?.mediaUri && ex.mediaUri !== mediaUri) deletePhotoFile(ex.mediaUri);
}
