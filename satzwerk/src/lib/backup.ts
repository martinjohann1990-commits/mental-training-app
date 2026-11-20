import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { Platform } from 'react-native';

import { getSqlite } from '@/db/client';
import { allHabitsQuery, type HabitInput, updateHabit } from '@/db/repo/habits';
import { writeSetting } from '@/db/repo/settings';
import {
  BACKUP_TABLES,
  type BackupCheck,
  backupFileName,
  type BackupData,
  type BackupTable,
  buildBackup,
  mediaRefs,
  prepareRow,
  type Row,
  safeColumns,
  validateBackup,
} from '@/domain/backup';

import { readStoredFile, writeStoredFile } from './photo-storage';

async function schemaVersion(): Promise<number> {
  try {
    const r = await getSqlite().getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM __drizzle_migrations');
    return r?.n ?? 0;
  } catch {
    return 0;
  }
}

export type ExportResult = { fileName: string; bytes: number; counts: { tables: number; rows: number; media: number; missingMedia: number } };

/** Erstellt die ZIP-Sicherung und öffnet das Teilen-Menü (Web: Download). */
export async function exportBackup(): Promise<ExportResult> {
  const sqlite = getSqlite();
  const tables: Partial<Record<BackupTable, Row[]>> = {};
  let rows = 0;
  for (const t of BACKUP_TABLES) {
    // Tabellennamen stammen aus der festen Liste – kein Nutzer-Input.
    const list = await sqlite.getAllAsync<Row>(`SELECT * FROM "${t}"`);
    tables[t] = list;
    rows += list.length;
  }
  const now = Date.now();
  const data = buildBackup(tables, await schemaVersion(), now);
  const files: Zippable = { 'data.json': strToU8(JSON.stringify(data)) };
  let media = 0;
  let missingMedia = 0;
  for (const name of mediaRefs(tables)) {
    const bytes = await readStoredFile(name);
    if (bytes) {
      // Fotos/Videos sind bereits komprimiert → unkomprimiert speichern (schneller).
      files[`photos/${name}`] = [bytes, { level: 0 }];
      media += 1;
    } else if (Platform.OS !== 'web') {
      missingMedia += 1;
    }
  }
  const zip = zipSync(files, { level: 6 });
  const fileName = backupFileName(now);

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } else {
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(zip);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: 'Satzwerk-Backup speichern', UTI: 'public.zip-archive' });
    }
  }
  await writeSetting('lastBackupAt', now);
  return { fileName, bytes: zip.length, counts: { tables: BACKUP_TABLES.length, rows, media, missingMedia } };
}

export type LoadedBackup = { check: BackupCheck; files: Record<string, Uint8Array>; fileName: string };

/** Lässt eine Sicherungsdatei auswählen und prüft sie. null = abgebrochen. */
export async function pickBackup(): Promise<LoadedBackup | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const asset = r.assets[0];
  let bytes: Uint8Array;
  if (Platform.OS === 'web') {
    bytes = new Uint8Array(await (asset.file ? asset.file.arrayBuffer() : (await fetch(asset.uri)).arrayBuffer()));
  } else {
    bytes = await new File(asset.uri).bytes();
  }
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { check: { ok: false, error: 'Die Datei ist kein gültiges ZIP-Archiv.' }, files: {}, fileName: asset.name };
  }
  const json = files['data.json'];
  if (!json) return { check: { ok: false, error: 'In der ZIP-Datei fehlt data.json – das ist keine Satzwerk-Sicherung.' }, files, fileName: asset.name };
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(json));
  } catch {
    return { check: { ok: false, error: 'data.json ist beschädigt.' }, files, fileName: asset.name };
  }
  return { check: validateBackup(raw, await schemaVersion()), files, fileName: asset.name };
}

/** Ersetzt ALLE Daten durch die Sicherung. Danach sollte die App neu geladen werden. */
export async function restoreBackup(data: BackupData, files: Record<string, Uint8Array>): Promise<void> {
  const sqlite = getSqlite();
  await sqlite.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await sqlite.withTransactionAsync(async () => {
      for (const t of [...BACKUP_TABLES].reverse()) await sqlite.runAsync(`DELETE FROM "${t}"`);
      for (const t of BACKUP_TABLES) {
        for (const raw of data.tables[t] ?? []) {
          const row = prepareRow(t, raw);
          const cols = safeColumns(row);
          if (!cols.length) continue;
          const values = cols.map((c) => {
            const v = row[c];
            return v === undefined ? null : typeof v === 'object' && v !== null ? JSON.stringify(v) : (v as string | number | null);
          });
          await sqlite.runAsync(`INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, values);
        }
      }
    });
  } finally {
    await sqlite.execAsync('PRAGMA foreign_keys = ON;');
  }
  for (const [path, bytes] of Object.entries(files)) {
    if (path.startsWith('photos/')) writeStoredFile(path.slice('photos/'.length), bytes);
  }
  // Erinnerungen sind gerätespezifisch → neu planen.
  for (const h of await allHabitsQuery()) {
    if (!h.reminderTime) continue;
    const input: HabitInput = {
      name: h.name,
      kind: h.kind,
      dailyTarget: h.dailyTarget,
      unit: h.unit,
      frequency: h.frequency,
      timesPerWeek: h.timesPerWeek,
      reminderTime: h.reminderTime,
    };
    await updateHabit(h.id, input);
  }
  await writeSetting('lastBackupAt', Date.now());
}

/** App neu starten, damit alle Ansichten die wiederhergestellten Daten laden. */
export async function reloadApp(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.location?.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    // Im Entwicklungsmodus nicht verfügbar – Nutzer muss die App neu öffnen.
  }
}
