import { eq } from 'drizzle-orm';

import { db } from '../client';
import { settings } from '../schema';

export async function readAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function readSetting(key: string): Promise<unknown> {
  const all = await readAllSettings();
  return all[key] ?? null;
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}
