import { asc, eq } from 'drizzle-orm';

import { newId } from '@/lib/id';

import { db } from '../client';
import { type RoutineExercise, routineFolders, routines } from '../schema';

export const allRoutinesQuery = () => db.select().from(routines).orderBy(asc(routines.sort), asc(routines.createdAt));
export const allFoldersQuery = () => db.select().from(routineFolders).orderBy(asc(routineFolders.sort), asc(routineFolders.createdAt));

export type RoutineInput = {
  name: string;
  notes: string;
  folderId: string | null;
  exercises: RoutineExercise[];
  source?: string | null;
};

export async function createRoutine(input: RoutineInput): Promise<string> {
  const id = newId('rt_');
  const now = new Date();
  await db.insert(routines).values({
    id,
    name: input.name.trim() || 'Neue Routine',
    notes: input.notes.trim(),
    folderId: input.folderId,
    exercises: input.exercises,
    source: input.source ?? null,
    sort: now.getTime(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateRoutine(id: string, input: RoutineInput): Promise<void> {
  await db
    .update(routines)
    .set({
      name: input.name.trim() || 'Routine',
      notes: input.notes.trim(),
      folderId: input.folderId,
      exercises: input.exercises,
      updatedAt: new Date(),
    })
    .where(eq(routines.id, id));
}

export async function getRoutine(id: string) {
  const [r] = await db.select().from(routines).where(eq(routines.id, id));
  return r ?? null;
}

export async function duplicateRoutine(id: string): Promise<string | null> {
  const r = await getRoutine(id);
  if (!r) return null;
  return createRoutine({ name: `${r.name} (Kopie)`, notes: r.notes, folderId: r.folderId, exercises: r.exercises });
}

export async function moveRoutineToFolder(id: string, folderId: string | null): Promise<void> {
  await db.update(routines).set({ folderId, updatedAt: new Date() }).where(eq(routines.id, id));
}

export async function deleteRoutine(id: string): Promise<void> {
  await db.delete(routines).where(eq(routines.id, id));
}

export async function createFolder(name: string): Promise<string> {
  const id = newId('fd_');
  const now = new Date();
  await db.insert(routineFolders).values({ id, name: name.trim() || 'Ordner', sort: now.getTime(), createdAt: now, updatedAt: now });
  return id;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await db.update(routineFolders).set({ name: name.trim() || 'Ordner', updatedAt: new Date() }).where(eq(routineFolders.id, id));
}

/** Routinen im Ordner bleiben erhalten (folder_id wird per FK auf NULL gesetzt). */
export async function deleteFolder(id: string): Promise<void> {
  await db.delete(routineFolders).where(eq(routineFolders.id, id));
}
