import type { Equipment, Muscle } from './catalog';
import { canPerform, type EquipmentConfig } from './equipment';

export type FilterableExercise = {
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
};

export type ExerciseFilter = {
  query: string;
  muscle: Muscle | null;
  equipment: Equipment | null;
  /** Nur Übungen, die mit dem aktiven Equipment-Profil möglich sind. */
  onlyAvailable: boolean;
};

export const EMPTY_FILTER: ExerciseFilter = { query: '', muscle: null, equipment: null, onlyAvailable: false };

/** Kleinschreibung, Umlaute auflösen, Sonderzeichen entfernen – damit „kreuzheben“, „Kreuz-heben“ und „KB“ matchen. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesFilter(
  ex: FilterableExercise,
  filter: ExerciseFilter,
  equipmentConfig: EquipmentConfig | null,
): boolean {
  if (filter.muscle && ex.primaryMuscle !== filter.muscle && !ex.secondaryMuscles.includes(filter.muscle)) {
    return false;
  }
  if (filter.equipment) {
    if (filter.equipment === 'bodyweight') {
      if (ex.equipment.length > 0) return false;
    } else if (!ex.equipment.includes(filter.equipment)) {
      return false;
    }
  }
  if (filter.onlyAvailable && equipmentConfig && !canPerform(equipmentConfig, ex.equipment)) {
    return false;
  }
  const q = normalizeSearch(filter.query);
  if (q) {
    const name = normalizeSearch(ex.name);
    // Alle Suchwörter müssen vorkommen (Reihenfolge egal).
    if (!q.split(' ').every((word) => name.includes(word))) return false;
  }
  return true;
}

export function filterExercises<T extends FilterableExercise>(
  list: T[],
  filter: ExerciseFilter,
  equipmentConfig: EquipmentConfig | null,
): T[] {
  return list
    .filter((e) => matchesFilter(e, filter, equipmentConfig))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
