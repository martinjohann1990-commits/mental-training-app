import type { PlateStock } from './equipment';

export type PlateResult = {
  /** Scheiben pro Seite, schwerste zuerst. */
  perSide: { weight: number; count: number }[];
  /** Tatsächlich erreichtes Gesamtgewicht (Stange + Scheiben). */
  achieved: number;
  /** Differenz zum Zielgewicht (>0: Ziel nicht ganz erreichbar). */
  missing: number;
};

const EPS = 1e-6;

/**
 * Berechnet die Scheiben pro Seite für ein Zielgewicht.
 * Sucht exakt (Tiefensuche über den begrenzten Bestand) und nimmt sonst die beste Annäherung nach unten.
 */
export function calculatePlates(target: number, barWeight: number, stock: PlateStock[]): PlateResult {
  const plates = [...stock].filter((p) => p.pairs > 0 && p.weight > 0).sort((a, b) => b.weight - a.weight);
  const perSideTarget = (target - barWeight) / 2;
  if (perSideTarget <= EPS) {
    return { perSide: [], achieved: barWeight, missing: Math.max(0, target - barWeight) };
  }

  let best: number[] = plates.map(() => 0);
  let bestSum = 0;
  const counts = plates.map(() => 0);

  function search(i: number, remaining: number, sum: number): boolean {
    if (sum > bestSum + EPS) {
      bestSum = sum;
      best = [...counts];
    }
    if (Math.abs(remaining) < EPS) return true;
    if (i >= plates.length) return false;
    const max = Math.min(plates[i].pairs, Math.floor((remaining + EPS) / plates[i].weight));
    for (let n = max; n >= 0; n--) {
      counts[i] = n;
      if (search(i + 1, remaining - n * plates[i].weight, sum + n * plates[i].weight)) return true;
    }
    counts[i] = 0;
    return false;
  }
  search(0, perSideTarget, 0);

  const perSide = plates.map((p, i) => ({ weight: p.weight, count: best[i] })).filter((p) => p.count > 0);
  const achieved = Math.round((barWeight + 2 * bestSum) * 1000) / 1000;
  return { perSide, achieved, missing: Math.round((target - achieved) * 1000) / 1000 };
}
