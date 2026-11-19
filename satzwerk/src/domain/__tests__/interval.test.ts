import { intervalStateAt, intervalTotalSeconds } from '@/domain/interval';

describe('Intervall-Timer', () => {
  it('EMOM: neue Runde jede Minute', () => {
    const c = { mode: 'emom' as const, minutes: 3, repsPerMinute: 5 };
    expect(intervalStateAt(c, 0)).toMatchObject({ phase: 'work', round: 1, remaining: 60 });
    expect(intervalStateAt(c, 59.2)).toMatchObject({ round: 1, remaining: 1 });
    expect(intervalStateAt(c, 60)).toMatchObject({ round: 2, remaining: 60 });
    expect(intervalStateAt(c, 180)).toMatchObject({ phase: 'done', round: 3 });
  });
  it('AMRAP: ein Countdown', () => {
    const c = { mode: 'amrap' as const, minutes: 10 };
    expect(intervalStateAt(c, 30)).toMatchObject({ phase: 'work', remaining: 570 });
    expect(intervalStateAt(c, 600).phase).toBe('done');
  });
  it('Tabata: Arbeit/Pause im Wechsel, keine Pause nach letzter Runde', () => {
    const c = { mode: 'tabata' as const, workSeconds: 20, restSeconds: 10, rounds: 8 };
    expect(intervalTotalSeconds(c)).toBe(8 * 20 + 7 * 10);
    expect(intervalStateAt(c, 5)).toMatchObject({ phase: 'work', round: 1, remaining: 15 });
    expect(intervalStateAt(c, 22)).toMatchObject({ phase: 'rest', round: 1, remaining: 8 });
    expect(intervalStateAt(c, 30)).toMatchObject({ phase: 'work', round: 2, remaining: 20 });
    expect(intervalStateAt(c, 229)).toMatchObject({ phase: 'work', round: 8, remaining: 1 });
    expect(intervalStateAt(c, 230).phase).toBe('done');
  });
});
