import { formatDuration, formatWeight, fromDisplayWeight, parseDuration, toDisplayWeight } from '@/domain/units';

describe('Einheiten', () => {
  it('kg ↔ lbs', () => {
    expect(toDisplayWeight(100, 'lbs')).toBeCloseTo(220.46, 1);
    expect(fromDisplayWeight(225, 'lbs')).toBeCloseTo(102.06, 1);
    expect(toDisplayWeight(fromDisplayWeight(135, 'lbs'), 'lbs')).toBe(135);
  });
  it('formatiert deutsch', () => {
    expect(formatWeight(22.5, 'kg')).toBe('22,5 kg');
    expect(formatWeight(null, 'kg')).toBe('–');
  });
  it('Dauer', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('1:x')).toBeNull();
  });
});
