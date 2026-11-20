import { and, asc, desc, eq } from 'drizzle-orm';

import { newId } from '@/lib/id';
import { deletePhotoFile } from '@/lib/photo-storage';

import { db } from '../client';
import { measurementFields, measurements, type PhotoPose, progressPhotos } from '../schema';

export const allMeasurementsQuery = () => db.select().from(measurements).orderBy(asc(measurements.day));
export const customFieldsQuery = () => db.select().from(measurementFields).orderBy(asc(measurementFields.createdAt));
export const allPhotosQuery = () => db.select().from(progressPhotos).orderBy(desc(progressPhotos.day), asc(progressPhotos.createdAt));

/** Speichert mehrere Werte eines Tages (Upsert pro Tag+Feld). `null` löscht den Wert. */
export async function saveMeasurements(day: string, values: Record<string, number | null>): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === null) {
        await tx.delete(measurements).where(and(eq(measurements.day, day), eq(measurements.key, key)));
        continue;
      }
      await tx
        .insert(measurements)
        .values({ id: newId('ms_'), day, key, value, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: [measurements.day, measurements.key], set: { value, updatedAt: now } });
    }
  });
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.delete(measurements).where(eq(measurements.id, id));
}

export async function createCustomField(name: string, unit: string): Promise<string> {
  const id = newId('mf_');
  const now = new Date();
  await db.insert(measurementFields).values({ id, name: name.trim() || 'Eigenes Maß', unit, createdAt: now, updatedAt: now });
  return id;
}

/** Löscht das Feld samt aller Werte. */
export async function deleteCustomField(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(measurements).where(eq(measurements.key, `custom:${id}`));
    await tx.delete(measurementFields).where(eq(measurementFields.id, id));
  });
}

export async function addPhoto(day: string, pose: PhotoPose, uri: string, note = ''): Promise<string> {
  const id = newId('pp_');
  const now = new Date();
  await db.insert(progressPhotos).values({ id, day, pose, uri, note, createdAt: now, updatedAt: now });
  return id;
}

export async function updatePhoto(id: string, patch: { pose?: PhotoPose; note?: string; day?: string }): Promise<void> {
  await db.update(progressPhotos).set({ ...patch, updatedAt: new Date() }).where(eq(progressPhotos.id, id));
}

export async function deletePhoto(id: string): Promise<void> {
  const [p] = await db.select().from(progressPhotos).where(eq(progressPhotos.id, id));
  if (!p) return;
  await db.delete(progressPhotos).where(eq(progressPhotos.id, id));
  deletePhotoFile(p.uri);
}
