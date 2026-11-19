import {
  canPerform,
  defaultEquipmentConfig,
  dumbbellWeights,
  normalizeKettlebells,
  parseEquipmentConfig,
} from '@/domain/equipment';

describe('dumbbellWeights', () => {
  it('erzeugt 1,5-kg-Schritte ohne Rundungsfehler', () => {
    expect(dumbbellWeights({ min: 2, max: 11, step: 1.5 })).toEqual([2, 3.5, 5, 6.5, 8, 9.5, 11]);
  });
  it('schließt das Maximum nur ein, wenn es exakt getroffen wird', () => {
    expect(dumbbellWeights({ min: 2, max: 10, step: 1.5 })).toEqual([2, 3.5, 5, 6.5, 8, 9.5]);
  });
  it('liefert leere Liste bei ungültigem Bereich', () => {
    expect(dumbbellWeights({ min: 10, max: 2, step: 1.5 })).toEqual([]);
    expect(dumbbellWeights({ min: 2, max: 10, step: 0 })).toEqual([]);
  });
});

describe('normalizeKettlebells', () => {
  it('sortiert, entfernt Duplikate und ungültige Stufen', () => {
    expect(normalizeKettlebells([24, 16, 16, 13, 8])).toEqual([8, 16, 24]);
  });
});

describe('canPerform', () => {
  const home = defaultEquipmentConfig('home');
  it('Körpergewichtsübungen gehen immer', () => {
    expect(canPerform({ ...home, available: [] }, [])).toBe(true);
  });
  it('alle benötigten Geräte müssen vorhanden sein', () => {
    expect(canPerform(home, ['kettlebell'])).toBe(true);
    expect(canPerform(home, ['dumbbell', 'bench'])).toBe(true);
    expect(canPerform(home, ['barbell', 'bench', 'rack'])).toBe(false);
  });
});

describe('parseEquipmentConfig', () => {
  it('fällt bei Müll auf Defaults zurück', () => {
    expect(parseEquipmentConfig(null)).toEqual(defaultEquipmentConfig('home'));
    expect(parseEquipmentConfig('x')).toEqual(defaultEquipmentConfig('home'));
  });
  it('verwirft unbekannte Geräte und ungültige Zahlen', () => {
    const c = parseEquipmentConfig({
      available: ['kettlebell', 'laser'],
      kettlebells: [16, 17],
      dumbbells: { min: -1, max: 20, step: 'x' },
      barbell: { barWeight: 15, plates: [{ weight: 10, pairs: 2.7 }, { weight: 0, pairs: 1 }, { weight: 20, pairs: 1 }] },
    });
    expect(c.available).toEqual(['kettlebell']);
    expect(c.kettlebells).toEqual([16]);
    expect(c.dumbbells).toEqual({ min: 2, max: 20, step: 1.5 });
    expect(c.barbell).toEqual({ barWeight: 15, plates: [{ weight: 20, pairs: 1 }, { weight: 10, pairs: 2 }] });
  });
  it('Round-Trip über JSON bleibt stabil', () => {
    const gym = defaultEquipmentConfig('gym');
    expect(parseEquipmentConfig(JSON.parse(JSON.stringify(gym)))).toEqual(gym);
  });
});
