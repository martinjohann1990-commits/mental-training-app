import { KG_PER_LB, type Unit } from './units';

export type MeasureUnit = 'kg' | 'cm' | '%' | '';

export type MeasureField = { key: string; label: string; unit: MeasureUnit; custom?: boolean };

/** Standard-Maße. Keys werden gespeichert – nicht umbenennen. */
export const STANDARD_FIELDS: MeasureField[] = [
  { key: 'weight', label: 'Körpergewicht', unit: 'kg' },
  { key: 'bodyfat', label: 'Körperfett', unit: '%' },
  { key: 'chest', label: 'Brust', unit: 'cm' },
  { key: 'waist', label: 'Taille', unit: 'cm' },
  { key: 'hips', label: 'Hüfte', unit: 'cm' },
  { key: 'arm_l', label: 'Oberarm links', unit: 'cm' },
  { key: 'arm_r', label: 'Oberarm rechts', unit: 'cm' },
  { key: 'thigh_l', label: 'Oberschenkel links', unit: 'cm' },
  { key: 'thigh_r', label: 'Oberschenkel rechts', unit: 'cm' },
  { key: 'calf', label: 'Wade', unit: 'cm' },
  { key: 'neck', label: 'Nacken', unit: 'cm' },
  { key: 'shoulders', label: 'Schultern', unit: 'cm' },
];

export const CM_PER_IN = 2.54;

/** Anzeigeeinheit je nach Einstellung (kg/cm oder lbs/in). */
export function displayUnit(u: MeasureUnit, unit: Unit): string {
  if (unit === 'lbs') {
    if (u === 'kg') return 'lbs';
    if (u === 'cm') return 'in';
  }
  return u;
}

export function toDisplayMeasure(value: number, u: MeasureUnit, unit: Unit): number {
  let v = value;
  if (unit === 'lbs' && u === 'kg') v = value / KG_PER_LB;
  if (unit === 'lbs' && u === 'cm') v = value / CM_PER_IN;
  return Math.round(v * 10) / 10;
}

export function fromDisplayMeasure(value: number, u: MeasureUnit, unit: Unit): number {
  if (unit === 'lbs' && u === 'kg') return value * KG_PER_LB;
  if (unit === 'lbs' && u === 'cm') return value * CM_PER_IN;
  return value;
}

export function formatMeasure(value: number, u: MeasureUnit, unit: Unit): string {
  const v = toDisplayMeasure(value, u, unit);
  const du = displayUnit(u, unit);
  return `${String(v).replace('.', ',')}${du ? (du === '%' ? ' %' : ` ${du}`) : ''}`;
}

/** Lokales Datum als 'YYYY-MM-DD'. */
export function dayKey(t: number | Date): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayToTime(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

export function formatDay(day: string, withYear = true): string {
  return new Date(dayToTime(day)).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export type MeasureEntry = { day: string; key: string; value: number };

export type FieldSummary = {
  key: string;
  latest: MeasureEntry | null;
  previous: MeasureEntry | null;
  first: MeasureEntry | null;
  /** latest − previous */
  change: number | null;
  /** latest − first */
  total: number | null;
  count: number;
};

/** Pro Feld: letzter, vorheriger und erster Wert. */
export function summarizeFields(entries: MeasureEntry[], keys: string[]): FieldSummary[] {
  return keys.map((key) => {
    const list = entries.filter((e) => e.key === key).sort((a, b) => a.day.localeCompare(b.day));
    const latest = list[list.length - 1] ?? null;
    const previous = list[list.length - 2] ?? null;
    const first = list[0] ?? null;
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      key,
      latest,
      previous,
      first,
      change: latest && previous ? round(latest.value - previous.value) : null,
      total: latest && first && list.length > 1 ? round(latest.value - first.value) : null,
      count: list.length,
    };
  });
}

/** Wert eines Feldes am oder vor einem Tag (für Fotos: „Gewicht an dem Tag“). */
export function valueOnOrBefore(entries: MeasureEntry[], key: string, day: string): MeasureEntry | null {
  let best: MeasureEntry | null = null;
  for (const e of entries) {
    if (e.key !== key || e.day > day) continue;
    if (!best || e.day > best.day) best = e;
  }
  return best;
}
