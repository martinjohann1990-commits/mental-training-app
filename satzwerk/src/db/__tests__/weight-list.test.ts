import { parseWeightList } from '@/db/repo/custom-equipment';

jest.mock('@/db/client', () => ({ db: {} }));

describe('parseWeightList', () => {
  it('trennt per Leerzeichen, Semikolon und Komma+Leerzeichen; Komma zwischen Ziffern = Dezimal', () => {
    expect(parseWeightList('10, 15,5; 20')).toEqual([10, 15.5, 20]);
    expect(parseWeightList('20 10 10  5')).toEqual([5, 10, 20]);
    expect(parseWeightList('abc, -3, 0')).toEqual([]);
    expect(parseWeightList('')).toEqual([]);
  });
});
