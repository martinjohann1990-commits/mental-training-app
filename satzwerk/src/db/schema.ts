import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Equipment, LoggingType, Muscle } from '@/domain/catalog';
import type { EquipmentConfig } from '@/domain/equipment';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
};

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  primaryMuscle: text('primary_muscle').$type<Muscle>().notNull(),
  secondaryMuscles: text('secondary_muscles', { mode: 'json' }).$type<Muscle[]>().notNull(),
  equipment: text('equipment', { mode: 'json' }).$type<Equipment[]>().notNull(),
  loggingType: text('logging_type').$type<LoggingType>().notNull(),
  instructions: text('instructions').notNull().default(''),
  complexParts: text('complex_parts', { mode: 'json' }).$type<string[] | null>(),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  /** Lokaler Pfad zu eigenem Foto/Video (ab Phase 4). */
  mediaUri: text('media_uri'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

export const equipmentProfiles = sqliteTable('equipment_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).$type<EquipmentConfig>().notNull(),
  ...timestamps,
});

/** Schlüssel/Wert-Einstellungen, Werte als JSON. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});

export type ExerciseRow = typeof exercises.$inferSelect;
export type NewExerciseRow = typeof exercises.$inferInsert;
export type EquipmentProfileRow = typeof equipmentProfiles.$inferSelect;
