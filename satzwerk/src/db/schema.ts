import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Equipment, LoggingType, Muscle } from '@/domain/catalog';
import type { EquipmentConfig } from '@/domain/equipment';
import type { IntervalConfig, SetType, SetValues } from '@/domain/workout';

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

export const routineFolders = sqliteTable('routine_folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sort: integer('sort').notNull().default(0),
  ...timestamps,
});

/** Vorgabe eines Satzes in einer Routine. */
export type RoutineSet = SetValues & { type: SetType };
export type RoutineExercise = {
  exerciseId: string;
  supersetGroup: number | null;
  restSeconds: number;
  note: string;
  interval: IntervalConfig | null;
  sets: RoutineSet[];
};

export const routines = sqliteTable('routines', {
  id: text('id').primaryKey(),
  folderId: text('folder_id').references(() => routineFolders.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  notes: text('notes').notNull().default(''),
  /** Routinen sind Vorlagen – die Übungen werden als JSON gespeichert. */
  exercises: text('exercises', { mode: 'json' }).$type<RoutineExercise[]>().notNull(),
  /** Herkunft, z. B. 'ai' für KI-Import (Phase 6). */
  source: text('source'),
  sort: integer('sort').notNull().default(0),
  ...timestamps,
});

export const workouts = sqliteTable(
  'workouts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    routineId: text('routine_id').references(() => routines.id, { onDelete: 'set null' }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }).notNull(),
    notes: text('notes').notNull().default(''),
    /** Gefühl 1–5. */
    rating: integer('rating'),
    /** Energie 1–5. */
    energy: integer('energy'),
    ...timestamps,
  },
  (t) => [index('workouts_started_idx').on(t.startedAt)],
);

export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: text('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    position: integer('position').notNull(),
    supersetGroup: integer('superset_group'),
    restSeconds: integer('rest_seconds').notNull(),
    note: text('note').notNull().default(''),
    interval: text('interval', { mode: 'json' }).$type<IntervalConfig | null>(),
  },
  (t) => [index('wex_workout_idx').on(t.workoutId), index('wex_exercise_idx').on(t.exerciseId)],
);

export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: text('id').primaryKey(),
    workoutExerciseId: text('workout_exercise_id')
      .notNull()
      .references(() => workoutExercises.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    type: text('type').$type<SetType>().notNull(),
    weight: real('weight'),
    reps: integer('reps'),
    repsRight: integer('reps_right'),
    duration: integer('duration'),
    distance: real('distance'),
    rpe: real('rpe'),
    note: text('note').notNull().default(''),
  },
  (t) => [index('wset_wex_idx').on(t.workoutExerciseId)],
);

export type RoutineRow = typeof routines.$inferSelect;
export type RoutineFolderRow = typeof routineFolders.$inferSelect;
export type WorkoutRow = typeof workouts.$inferSelect;
export type WorkoutExerciseRow = typeof workoutExercises.$inferSelect;
export type WorkoutSetRow = typeof workoutSets.$inferSelect;
export type ExerciseRow = typeof exercises.$inferSelect;
export type NewExerciseRow = typeof exercises.$inferInsert;
export type EquipmentProfileRow = typeof equipmentProfiles.$inferSelect;
