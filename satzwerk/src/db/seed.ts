import { eq, sql } from 'drizzle-orm';

import { BUILTIN_EXERCISES } from '@/data/exercises';
import { defaultEquipmentConfig } from '@/domain/equipment';

import type { Db } from './client';
import { equipmentProfiles, exercises, settings } from './schema';

/**
 * Wird bei jedem App-Start nach den Migrationen ausgeführt.
 * - Mitgelieferte Übungen werden eingefügt bzw. aktualisiert (Archiv-Status und eigene Medien bleiben erhalten).
 * - Beim ersten Start werden zwei Equipment-Profile und Standard-Einstellungen angelegt.
 */
export async function seedDatabase(db: Db): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const e of BUILTIN_EXERCISES) {
      const values = {
        id: e.id,
        name: e.name,
        primaryMuscle: e.primaryMuscle,
        secondaryMuscles: e.secondaryMuscles,
        equipment: e.equipment,
        loggingType: e.loggingType,
        instructions: e.instructions,
        complexParts: e.complexParts ?? null,
        isCustom: false,
        updatedAt: now,
      };
      await tx
        .insert(exercises)
        .values({ ...values, createdAt: now })
        .onConflictDoUpdate({ target: exercises.id, set: values });
    }

    const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(equipmentProfiles);
    if (count === 0) {
      await tx.insert(equipmentProfiles).values([
        { id: 'home', name: 'Home Gym', config: defaultEquipmentConfig('home'), createdAt: now, updatedAt: now },
        { id: 'gym', name: 'Studio', config: defaultEquipmentConfig('gym'), createdAt: now, updatedAt: now },
      ]);
    }

    const defaults: Record<string, unknown> = { unit: 'kg', theme: 'dark', activeProfileId: 'home' };
    for (const [key, value] of Object.entries(defaults)) {
      const existing = await tx.select().from(settings).where(eq(settings.key, key));
      if (existing.length === 0) await tx.insert(settings).values({ key, value });
    }
  });
}
