/** Parst Benutzereingaben mit Komma oder Punkt („1,5“ → 1.5). Liefert null bei ungültigem Wert. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Formatiert Zahlen deutsch, ohne überflüssige Nachkommastellen („1,5“, „20“, „1,25“). */
export function formatDecimal(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}
