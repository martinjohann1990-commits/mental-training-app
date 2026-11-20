import { dayKey, formatMeasure, fromDisplayMeasure, summarizeFields, toDisplayMeasure, valueOnOrBefore } from '@/domain/body';

describe('Körpermaße', () => {
  it('dayKey ist lokal und nullgepolstert', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
  it('Umrechnung cm/in und kg/lbs', () => {
    expect(toDisplayMeasure(100, 'cm', 'lbs')).toBe(39.4);
    expect(fromDisplayMeasure(10, 'cm', 'lbs')).toBeCloseTo(25.4);
    expect(toDisplayMeasure(80, 'kg', 'lbs')).toBe(176.4);
    expect(toDisplayMeasure(18.5, '%', 'lbs')).toBe(18.5);
    expect(formatMeasure(82.35, 'kg', 'kg')).toBe('82,4 kg');
    expect(formatMeasure(18, '%', 'kg')).toBe('18 %');
  });
  const entries = [
    { day: '2026-11-01', key: 'weight', value: 84 },
    { day: '2026-11-15', key: 'weight', value: 82.5 },
    { day: '2026-11-08', key: 'weight', value: 83 },
    { day: '2026-11-08', key: 'waist', value: 90 },
  ];
  it('summarizeFields: letzter, vorheriger, erster Wert', () => {
    const [w, waist, chest] = summarizeFields(entries, ['weight', 'waist', 'chest']);
    expect(w).toMatchObject({ latest: { value: 82.5 }, change: -0.5, total: -1.5, count: 3 });
    expect(waist).toMatchObject({ change: null, total: null, count: 1 });
    expect(chest).toMatchObject({ latest: null, count: 0 });
  });
  it('valueOnOrBefore', () => {
    expect(valueOnOrBefore(entries, 'weight', '2026-11-10')?.value).toBe(83);
    expect(valueOnOrBefore(entries, 'weight', '2026-10-01')).toBeNull();
  });
});
