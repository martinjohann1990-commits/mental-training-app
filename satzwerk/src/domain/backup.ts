/**
 * Backup-Format und -Prüfung. Rein und testbar.
 *
 * Aufbau der ZIP-Datei:
 *   data.json         { format, version, schemaVersion, exportedAt, app, tables: { <tabelle>: Zeilen[] } }
 *   photos/<datei>    Fortschrittsfotos und eigene Übungsmedien
 *
 * Die Zeilen sind Roh-Zeilen aus SQLite (Zeitstempel als Zahlen, JSON-Spalten als Text) –
 * dadurch ist der Export unabhängig von einzelnen Spalten und verlustfrei.
 */

export const BACKUP_FORMAT = 'satzwerk-backup';
export const BACKUP_VERSION = 1;

/** Reihenfolge = Einfüge-Reihenfolge (Eltern vor Kindern). Löschen in umgekehrter Reihenfolge. */
export const BACKUP_TABLES = [
  'settings',
  'equipment_profiles',
  'custom_equipment',
  'exercises',
  'routine_folders',
  'routines',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'measurement_fields',
  'measurements',
  'progress_photos',
  'habits',
  'habit_logs',
  'goals',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type Row = Record<string, unknown>;

export type BackupData = {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** Anzahl angewendeter DB-Migrationen beim Export. */
  schemaVersion: number;
  exportedAt: number;
  app: string;
  tables: Partial<Record<BackupTable, Row[]>>;
};

/** Spalten, die gerätespezifisch sind und beim Wiederherstellen geleert werden. */
export const DEVICE_SPECIFIC_COLUMNS: Partial<Record<BackupTable, string[]>> = {
  habits: ['reminder_notification_id'],
};

export function buildBackup(tables: Partial<Record<BackupTable, Row[]>>, schemaVersion: number, now: number, app = 'Satzwerk'): BackupData {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, schemaVersion, exportedAt: now, app, tables };
}

/** Dateinamen aller referenzierten Medien (keine URIs/Data-URIs). */
export function mediaRefs(tables: Partial<Record<BackupTable, Row[]>>): string[] {
  const refs = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'string' && v && !v.includes(':') && !v.includes('/')) refs.add(v);
  };
  tables.progress_photos?.forEach((r) => add(r.uri));
  tables.exercises?.forEach((r) => add(r.media_uri));
  return [...refs];
}

export type BackupCheck =
  | { ok: true; data: BackupData; counts: { workouts: number; routines: number; photos: number; measurements: number; habits: number; goals: number } }
  | { ok: false; error: string };

/** Prüft eine geladene data.json gegen Format und App-Version. */
export function validateBackup(raw: unknown, currentSchemaVersion: number): BackupCheck {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Die Datei enthält keine gültigen Daten.' };
  const o = raw as Partial<BackupData>;
  if (o.format !== BACKUP_FORMAT) return { ok: false, error: 'Das ist keine Satzwerk-Sicherung.' };
  if (typeof o.version !== 'number' || o.version > BACKUP_VERSION) {
    return { ok: false, error: 'Die Sicherung stammt aus einer neueren App-Version. Bitte zuerst Satzwerk aktualisieren.' };
  }
  if (typeof o.schemaVersion !== 'number' || o.schemaVersion > currentSchemaVersion) {
    return { ok: false, error: 'Die Sicherung stammt aus einer neueren App-Version. Bitte zuerst Satzwerk aktualisieren.' };
  }
  if (!o.tables || typeof o.tables !== 'object') return { ok: false, error: 'In der Sicherung fehlen die Tabellen.' };
  for (const [name, rows] of Object.entries(o.tables)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(name)) return { ok: false, error: `Unbekannte Tabelle „${name}“ in der Sicherung.` };
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
      return { ok: false, error: `Tabelle „${name}“ ist beschädigt.` };
    }
  }
  const n = (t: BackupTable) => o.tables?.[t]?.length ?? 0;
  return {
    ok: true,
    data: o as BackupData,
    counts: {
      workouts: n('workouts'),
      routines: n('routines'),
      photos: n('progress_photos'),
      measurements: n('measurements'),
      habits: n('habits'),
      goals: n('goals'),
    },
  };
}

/** Nur sichere Spaltennamen zulassen (werden in SQL eingesetzt). */
export function safeColumns(row: Row): string[] {
  return Object.keys(row).filter((k) => /^[a-z_][a-z0-9_]*$/.test(k));
}

/** Zeile für das Wiederherstellen vorbereiten (gerätespezifische Spalten leeren). */
export function prepareRow(table: BackupTable, row: Row): Row {
  const out: Row = { ...row };
  for (const col of DEVICE_SPECIFIC_COLUMNS[table] ?? []) if (col in out) out[col] = null;
  return out;
}

export const BACKUP_REMINDER_DAYS = 14;
const DAY = 86_400_000;

/**
 * Erinnerung zeigen? Ja, wenn es nennenswerte Daten gibt (erstes Workout älter als 3 Tage)
 * und das letzte Backup fehlt oder älter als 14 Tage ist – außer sie wurde kürzlich weggeklickt.
 */
export function shouldRemindBackup(opts: {
  now: number;
  lastBackupAt: number | null;
  firstDataAt: number | null;
  snoozedUntil: number | null;
}): { remind: boolean; daysSince: number | null } {
  const daysSince = opts.lastBackupAt ? Math.floor((opts.now - opts.lastBackupAt) / DAY) : null;
  if (opts.snoozedUntil && opts.snoozedUntil > opts.now) return { remind: false, daysSince };
  if (!opts.firstDataAt || opts.now - opts.firstDataAt < 3 * DAY) return { remind: false, daysSince };
  return { remind: daysSince === null || daysSince >= BACKUP_REMINDER_DAYS, daysSince };
}

export function backupFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `satzwerk-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;
}
