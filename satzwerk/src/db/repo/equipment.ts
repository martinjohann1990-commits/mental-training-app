import { asc, eq } from 'drizzle-orm';

import { defaultEquipmentConfig, type EquipmentConfig, parseEquipmentConfig } from '@/domain/equipment';
import { newId } from '@/lib/id';

import { db } from '../client';
import { equipmentProfiles } from '../schema';

export const allProfilesQuery = () => db.select().from(equipmentProfiles).orderBy(asc(equipmentProfiles.createdAt));

export const profileByIdQuery = (id: string) => db.select().from(equipmentProfiles).where(eq(equipmentProfiles.id, id));

export async function createProfile(name: string): Promise<string> {
  const id = newId('eq_');
  const now = new Date();
  await db.insert(equipmentProfiles).values({
    id,
    name: name.trim() || 'Neues Profil',
    config: defaultEquipmentConfig('home'),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function saveProfile(id: string, name: string, config: EquipmentConfig): Promise<void> {
  await db
    .update(equipmentProfiles)
    .set({ name: name.trim() || 'Profil', config: parseEquipmentConfig(config), updatedAt: new Date() })
    .where(eq(equipmentProfiles.id, id));
}

export async function deleteProfile(id: string): Promise<void> {
  await db.delete(equipmentProfiles).where(eq(equipmentProfiles.id, id));
}
