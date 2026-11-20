import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'satzwerk.db';

function createDb(sqlite: Parameters<typeof drizzle>[0]) {
  return drizzle(sqlite, { schema });
}
export type Db = ReturnType<typeof createDb>;

let instance: Db | null = null;
let sqliteInstance: SQLiteDatabase | null = null;

/**
 * Öffnet die Datenbank einmalig. Muss vor jedem Zugriff auf `db` abgeschlossen sein
 * (der Root-Layout wartet darauf). Async, weil SQLite auf dem Web erst einen Worker lädt.
 */
export async function initDatabase(): Promise<Db> {
  if (instance) return instance;
  const sqlite = await openDatabaseAsync(DATABASE_NAME, { enableChangeListener: true });
  await sqlite.execAsync('PRAGMA foreign_keys = ON;');
  sqliteInstance = sqlite;
  instance = createDb(sqlite);
  return instance;
}

/** Zugriff auf die geöffnete Datenbank. Wirft, falls `initDatabase()` noch nicht fertig ist. */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    if (!instance) throw new Error('Datenbank ist noch nicht initialisiert.');
    const value = Reflect.get(instance, prop, instance) as unknown;
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(instance) : value;
  },
});

/** Rohe SQLite-Verbindung (für Backup/Wiederherstellung). */
export function getSqlite(): SQLiteDatabase {
  if (!sqliteInstance) throw new Error('Datenbank ist noch nicht initialisiert.');
  return sqliteInstance;
}
