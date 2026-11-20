import { eq } from 'drizzle-orm';

import type { RoutineExerciseData } from '@/domain/routine';

import { db } from '../client';
import { routines } from '../schema';
import { createFolder, createRoutine } from './routines';

export type ImportRoutine = { name: string; notes: string; exercises: RoutineExerciseData[] };

/**
 * Speichert einen importierten KI-Plan.
 * - mode 'new': neuer Ordner mit dem Plannamen
 * - mode 'replace': Routinen im Ordner werden ersetzt (alte Workouts bleiben unberührt)
 * Liefert die Ordner-ID.
 */
export async function saveImportedPlan(opts: {
  planName: string;
  routines: ImportRoutine[];
  mode: 'new' | 'replace';
  folderId?: string | null;
}): Promise<string> {
  let folderId = opts.folderId ?? null;
  if (opts.mode === 'new' || !folderId) {
    folderId = await createFolder(opts.planName);
  } else {
    await db.delete(routines).where(eq(routines.folderId, folderId));
  }
  for (const r of opts.routines) {
    await createRoutine({ name: r.name, notes: r.notes, folderId, exercises: r.exercises, source: 'ai' });
  }
  return folderId;
}
