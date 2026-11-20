import { asc, eq } from 'drizzle-orm';

import type { EquipmentRef } from '@/domain/catalog';
import { parseEquipmentConfig } from '@/domain/equipment';
import { newId } from '@/lib/id';

import { db } from '../client';
import { customEquipment, equipmentProfiles, exercises } from '../schema';

export const customEquipmentQuery = () => db.select().from(customEquipment).orderBy(asc(customEquipment.createdAt));

/**
 * Gewichtsliste parsen: Leerzeichen, Semikolon oder „Komma + Leerzeichen“ trennen,
 * ein Komma direkt zwischen Ziffern ist ein Dezimalkomma. "10, 15,5; 20" → [10, 15.5, 20].
 */
export function parseWeightList(text: string): number[] {
  const nums = text
    .replace(/,\s+/g, ' ')
    .split(/[\s;]+/)
    .map((t) => Number(t.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(nums.map((n) => Math.round(n * 100) / 100))].sort((a, b) => a - b);
}

/** Legt ein eigenes Gerät an und macht es im angegebenen Profil verfügbar. */
export async function createCustomEquipment(name: string, weights: number[], enableInProfileId?: string): Promise<EquipmentRef> {
  const id = newId('ce_');
  const ref = `custom:${id}` as const;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(customEquipment).values({ id, name: name.trim() || 'Eigenes Gerät', weights, createdAt: now, updatedAt: now });
    if (enableInProfileId) {
      const [p] = await tx.select().from(equipmentProfiles).where(eq(equipmentProfiles.id, enableInProfileId));
      if (p) {
        const cfg = parseEquipmentConfig(p.config);
        await tx.update(equipmentProfiles).set({ config: { ...cfg, available: [...cfg.available, ref] }, updatedAt: now }).where(eq(equipmentProfiles.id, p.id));
      }
    }
  });
  return ref;
}

export async function updateCustomEquipment(id: string, name: string, weights: number[]): Promise<void> {
  await db.update(customEquipment).set({ name: name.trim() || 'Eigenes Gerät', weights, updatedAt: new Date() }).where(eq(customEquipment.id, id));
}

/** Löscht das Gerät und entfernt es aus allen Profilen und Übungen. */
export async function deleteCustomEquipment(id: string): Promise<void> {
  const ref = `custom:${id}`;
  await db.transaction(async (tx) => {
    for (const p of await tx.select().from(equipmentProfiles)) {
      const cfg = parseEquipmentConfig(p.config);
      if (cfg.available.includes(ref as EquipmentRef)) {
        await tx.update(equipmentProfiles).set({ config: { ...cfg, available: cfg.available.filter((e) => e !== ref) } }).where(eq(equipmentProfiles.id, p.id));
      }
    }
    for (const e of await tx.select({ id: exercises.id, equipment: exercises.equipment }).from(exercises)) {
      if (e.equipment.includes(ref as EquipmentRef)) {
        await tx.update(exercises).set({ equipment: e.equipment.filter((x) => x !== ref) }).where(eq(exercises.id, e.id));
      }
    }
    await tx.delete(customEquipment).where(eq(customEquipment.id, id));
  });
}
