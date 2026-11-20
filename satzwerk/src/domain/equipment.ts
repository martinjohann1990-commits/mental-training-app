import { EQUIPMENT_KEYS, type EquipmentRef, isEquipmentRef, KETTLEBELL_STEPS } from './catalog';

export type PlateStock = { weight: number; pairs: number };

export type EquipmentConfig = {
  /** Verfügbare Gerätekategorien. Körpergewicht ist immer verfügbar. */
  available: EquipmentRef[];
  kettlebells: number[];
  dumbbells: { min: number; max: number; step: number };
  barbell: { barWeight: number; plates: PlateStock[] };
  ezBar: { barWeight: number };
};

export const DEFAULT_PLATES: PlateStock[] = [
  { weight: 25, pairs: 0 },
  { weight: 20, pairs: 2 },
  { weight: 15, pairs: 1 },
  { weight: 10, pairs: 2 },
  { weight: 5, pairs: 2 },
  { weight: 2.5, pairs: 2 },
  { weight: 1.25, pairs: 2 },
];

export function defaultEquipmentConfig(kind: 'home' | 'gym'): EquipmentConfig {
  if (kind === 'gym') {
    return {
      available: [...EQUIPMENT_KEYS],
      kettlebells: [8, 12, 16, 20, 24, 28, 32],
      dumbbells: { min: 2, max: 50, step: 1.5 },
      barbell: { barWeight: 20, plates: DEFAULT_PLATES.map((p) => ({ ...p, pairs: 4 })) },
      ezBar: { barWeight: 10 },
    };
  }
  return {
    available: ['kettlebell', 'dumbbell', 'bench', 'pullup_bar', 'band', 'bodyweight'],
    kettlebells: [12, 16, 24],
    dumbbells: { min: 2, max: 32, step: 1.5 },
    barbell: { barWeight: 20, plates: DEFAULT_PLATES },
    ezBar: { barWeight: 10 },
  };
}

/** Rundet auf 2 Nachkommastellen, um Gleitkomma-Artefakte (z. B. 3.4999999) zu vermeiden. */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Alle Kurzhantelgewichte im Bereich [min, max] in Schritten von `step`. */
export function dumbbellWeights({ min, max, step }: EquipmentConfig['dumbbells']): number[] {
  if (step <= 0 || min > max) return [];
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const w = round2(min + i * step);
    if (w > max + 1e-9) break;
    out.push(w);
    if (out.length > 500) break;
  }
  return out;
}

/** Nur gültige KB-Stufen, sortiert, ohne Duplikate. */
export function normalizeKettlebells(weights: number[]): number[] {
  const valid = new Set<number>(KETTLEBELL_STEPS);
  return [...new Set(weights)].filter((w) => valid.has(w)).sort((a, b) => a - b);
}

export function isAvailable(config: EquipmentConfig, equipment: EquipmentRef): boolean {
  return equipment === 'bodyweight' || config.available.includes(equipment);
}

/** Kann eine Übung mit diesem Equipment ausgeführt werden? */
export function canPerform(config: EquipmentConfig, required: EquipmentRef[]): boolean {
  return required.every((e) => isAvailable(config, e));
}

/**
 * Normalisiert eine (z. B. aus der DB oder einem Backup geladene) Konfiguration,
 * füllt fehlende Felder mit Defaults auf und verwirft ungültige Werte.
 */
export function parseEquipmentConfig(raw: unknown): EquipmentConfig {
  const base = defaultEquipmentConfig('home');
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<EquipmentConfig>;
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
  return {
    available: Array.isArray(r.available)
      ? [...new Set(r.available.filter(isEquipmentRef))]
      : base.available,
    kettlebells: Array.isArray(r.kettlebells) ? normalizeKettlebells(r.kettlebells) : base.kettlebells,
    dumbbells: {
      min: num(r.dumbbells?.min, base.dumbbells.min),
      max: num(r.dumbbells?.max, base.dumbbells.max),
      step: num(r.dumbbells?.step, base.dumbbells.step) || base.dumbbells.step,
    },
    barbell: {
      barWeight: num(r.barbell?.barWeight, base.barbell.barWeight),
      plates: Array.isArray(r.barbell?.plates)
        ? r.barbell.plates
            .filter((p) => p && num(p.weight, 0) > 0)
            .map((p) => ({ weight: p.weight, pairs: Math.floor(num(p.pairs, 0)) }))
            .sort((a, b) => b.weight - a.weight)
        : base.barbell.plates,
    },
    ezBar: { barWeight: num(r.ezBar?.barWeight, base.ezBar.barWeight) },
  };
}
