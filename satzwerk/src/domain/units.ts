export type Unit = 'kg' | 'lbs';

export const KG_PER_LB = 0.45359237;

/** Intern wird immer in kg gespeichert. */
export function toDisplayWeight(kg: number, unit: Unit): number {
  const v = unit === 'kg' ? kg : kg / KG_PER_LB;
  return Math.round(v * 100) / 100;
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function formatWeight(kg: number | null | undefined, unit: Unit): string {
  if (kg === null || kg === undefined) return '–';
  const v = toDisplayWeight(kg, unit);
  // lbs auf 0,5 runden, kg auf 0,25 – reicht für Hantelscheiben.
  const step = unit === 'kg' ? 0.25 : 0.5;
  const r = Math.round(v / step) * step;
  return `${String(Math.round(r * 100) / 100).replace('.', ',')} ${unit}`;
}

/** 90 → "1:30", 3725 → "1:02:05". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Akzeptiert "90", "1:30", "1:02:05". */
export function parseDuration(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(s)) return null;
  return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}
