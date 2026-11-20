import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { newId } from './id';

/**
 * Fotos liegen im privaten App-Speicher (nicht in der Galerie sichtbar).
 * In der DB steht nur der Dateiname; die volle URI wird zur Laufzeit gebildet,
 * damit sich ein geänderter App-Pfad (z. B. nach Wiederherstellung) nicht auswirkt.
 * Auf dem Web (nur für Tests) wird die Daten-URI direkt gespeichert.
 */
const DIR_NAME = 'photos';

function photoDir(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Kopiert ein gewähltes/aufgenommenes Bild in den privaten Speicher. Liefert den zu speichernden Wert. */
export async function storePhoto(sourceUri: string, prefix = 'ph_'): Promise<string> {
  if (Platform.OS === 'web') return sourceUri;
  const ext = (sourceUri.split('?')[0].match(/\.(jpe?g|png|heic|webp|mp4|mov|m4v)$/i)?.[1] ?? 'jpg').toLowerCase();
  const name = `${newId(prefix)}.${ext}`;
  const target = new File(photoDir(), name);
  await new File(sourceUri).copy(target);
  return name;
}

/** Gespeicherten Wert → anzeigbare URI. */
export function photoUri(stored: string): string {
  if (Platform.OS === 'web' || stored.includes(':')) return stored;
  return new File(photoDir(), stored).uri;
}

export function deletePhotoFile(stored: string): void {
  if (Platform.OS === 'web' || stored.includes(':')) return;
  try {
    const f = new File(photoDir(), stored);
    if (f.exists) f.delete();
  } catch {
    // Datei fehlt bereits – ignorieren
  }
}

/** Öffnet eine Datei (z. B. Übungsvideo) im System-Viewer. */
export async function openInSystemViewer(stored: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const f = new File(photoDir(), stored);
    if (await f.canPreview()) {
      await f.preview();
      return true;
    }
  } catch {
    // fällt unten auf false zurück
  }
  return false;
}

export function isVideo(stored: string): boolean {
  return /\.(mp4|mov|m4v)$/i.test(stored) || stored.startsWith('data:video');
}
