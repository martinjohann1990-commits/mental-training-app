import { niceTicks } from '@/components/charts';

describe('niceTicks', () => {
  it('deckt Minimum und Maximum ab', () => {
    for (const [min, max] of [[93.3, 102.1], [0, 1533], [80, 80], [0.5, 7.2]]) {
      const t = niceTicks(min, max);
      expect(t[0]).toBeLessThanOrEqual(min);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(max);
      expect(t.length).toBeGreaterThanOrEqual(2);
    }
  });
});
