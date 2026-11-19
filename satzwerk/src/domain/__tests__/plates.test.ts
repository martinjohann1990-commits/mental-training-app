import { calculatePlates } from '@/domain/plates';

const stock = [
  { weight: 20, pairs: 2 }, { weight: 10, pairs: 2 }, { weight: 5, pairs: 1 },
  { weight: 2.5, pairs: 1 }, { weight: 1.25, pairs: 1 },
];

describe('calculatePlates', () => {
  it('100 kg mit 20-kg-Stange', () => {
    expect(calculatePlates(100, 20, stock)).toEqual({
      perSide: [{ weight: 20, count: 2 }], achieved: 100, missing: 0,
    });
  });
  it('kombiniert kleine Scheiben', () => {
    expect(calculatePlates(57.5, 20, stock).perSide).toEqual([
      { weight: 10, count: 1 }, { weight: 5, count: 1 }, { weight: 2.5, count: 1 }, { weight: 1.25, count: 1 },
    ]);
  });
  it('findet exakte Lösung, auch wenn Greedy scheitern würde', () => {
    // 30 pro Seite: 20+10 möglich; Bestand ohne 10er, aber 3×... → 15+15
    const r = calculatePlates(80, 20, [{ weight: 20, pairs: 1 }, { weight: 15, pairs: 2 }]);
    expect(r.perSide).toEqual([{ weight: 15, count: 2 }]);
    expect(r.missing).toBe(0);
  });
  it('meldet Rest, wenn der Bestand nicht reicht', () => {
    const r = calculatePlates(200, 20, stock);
    expect(r.achieved).toBe(20 + 2 * (40 + 20 + 5 + 2.5 + 1.25));
    expect(r.missing).toBeCloseTo(200 - r.achieved);
  });
  it('Ziel ≤ Stange: keine Scheiben', () => {
    expect(calculatePlates(15, 20, stock)).toMatchObject({ perSide: [], achieved: 20 });
  });
});
