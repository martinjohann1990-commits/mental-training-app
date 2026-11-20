import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { Equipment, LoggingType, Muscle } from '@/domain/catalog';
import type { EquipmentConfig } from '@/domain/equipment';
import type { GoalType } from '@/domain/goals';
import type { HabitFrequency, HabitKind } from '@/domain/habits';
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

/** Eigene Messfelder (zusätzlich zu den Standard-Maßen). */
export const measurementFields = sqliteTable('measurement_fields', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** 'cm' | 'kg' | '%' | '' */
  unit: text('unit').notNull().default('cm'),
  ...timestamps,
});

/** Ein Messwert pro Tag und Feld. `day` = lokales Datum 'YYYY-MM-DD'. */
export const measurements = sqliteTable(
  'measurements',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    key: text('key').notNull(),
    /** Intern immer kg bzw. cm bzw. %. */
    value: real('value').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('measurements_day_key_idx').on(t.day, t.key)],
);

export type PhotoPose = 'front' | 'side' | 'back' | 'other';

export const progressPhotos = sqliteTable(
  'progress_photos',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    pose: text('pose').$type<PhotoPose>().notNull(),
    /** Dateiname im App-Speicher (native) bzw. Daten-URI (Web). */
    uri: text('uri').notNull(),
    note: text('note').notNull().default(''),
    ...timestamps,
  },
  (t) => [index('photos_day_idx').on(t.day)],
);

export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').$type<HabitKind>().notNull(),
  dailyTarget: real('daily_target'),
  unit: text('unit').notNull().default(''),
  frequency: text('frequency').$type<HabitFrequency>().notNull(),
  timesPerWeek: integer('times_per_week'),
  /** 'HH:MM' oder null. */
  reminderTime: text('reminder_time'),
  reminderNotificationId: text('reminder_notification_id'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  sort: integer('sort').notNull().default(0),
  ...timestamps,
});

export const habitLogs = sqliteTable(
  'habit_logs',
  {
    id: text('id').primaryKey(),
    habitId: text('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    value: real('value').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('habit_logs_habit_day_idx').on(t.habitId, t.day)],
);

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  type: text('type').$type<GoalType>().notNull(),
  title: text('title').notNull(),
  /** strength: Übung; measurement: Feld-Key; habit: Gewohnheits-ID. */
  refId: text('ref_id'),
  /** strength: 'e1rm' | 'weight'. */
  metric: text('metric'),
  /** strength/weight: Gewicht muss mit mind. so vielen Wdh. geschafft werden. */
  targetReps: integer('target_reps'),
  startValue: real('start_value').notNull(),
  targetValue: real('target_value').notNull(),
  /** 'YYYY-MM-DD' oder null. */
  deadline: text('deadline'),
  achievedAt: integer('achieved_at', { mode: 'timestamp_ms' }),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

export type HabitRow = typeof habits.$inferSelect;
export type HabitLogRow = typeof habitLogs.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type MeasurementRow = typeof measurements.$inferSelect;
export type MeasurementFieldRow = typeof measurementFields.$inferSelect;
export type ProgressPhotoRow = typeof progressPhotos.$inferSelect;
export type RoutineRow = typeof routines.$inferSelect;
export type RoutineFolderRow = typeof routineFolders.$inferSelect;
export type WorkoutRow = typeof workouts.$inferSelect;
export type WorkoutExerciseRow = typeof workoutExercises.$inferSelect;
export type WorkoutSetRow = typeof workoutSets.$inferSelect;
export type ExerciseRow = typeof exercises.$inferSelect;
export type NewExerciseRow = typeof exercises.$inferInsert;
export type EquipmentProfileRow = typeof equipmentProfiles.$inferSelect;
