import type { IntervalConfig } from './workout';

export type IntervalPhase = 'work' | 'rest' | 'done';

export type IntervalState = {
  phase: IntervalPhase;
  /** 1-basiert. Bei AMRAP immer 1. */
  round: number;
  totalRounds: number;
  /** Verbleibende Sekunden in der aktuellen Phase (aufgerundet). */
  remaining: number;
  /** Gesamtdauer in Sekunden. */
  totalSeconds: number;
};

export function intervalTotalSeconds(c: IntervalConfig): number {
  switch (c.mode) {
    case 'emom':
    case 'amrap':
      return c.minutes * 60;
    case 'tabata':
      // Nach der letzten Arbeitsphase keine Pause mehr.
      return c.rounds * c.workSeconds + Math.max(0, c.rounds - 1) * c.restSeconds;
  }
}

/** Reine Zustandsfunktion: Wo steht der Timer nach `elapsed` Sekunden? */
export function intervalStateAt(c: IntervalConfig, elapsed: number): IntervalState {
  const totalSeconds = intervalTotalSeconds(c);
  const t = Math.max(0, elapsed);
  if (t >= totalSeconds) {
    const totalRounds = c.mode === 'emom' ? c.minutes : c.mode === 'tabata' ? c.rounds : 1;
    return { phase: 'done', round: totalRounds, totalRounds, remaining: 0, totalSeconds };
  }
  switch (c.mode) {
    case 'emom': {
      const round = Math.floor(t / 60) + 1;
      return { phase: 'work', round, totalRounds: c.minutes, remaining: Math.ceil(round * 60 - t), totalSeconds };
    }
    case 'amrap':
      return { phase: 'work', round: 1, totalRounds: 1, remaining: Math.ceil(totalSeconds - t), totalSeconds };
    case 'tabata': {
      const cycle = c.workSeconds + c.restSeconds;
      const round = Math.floor(t / cycle) + 1;
      const inCycle = t - (round - 1) * cycle;
      if (inCycle < c.workSeconds) {
        return { phase: 'work', round, totalRounds: c.rounds, remaining: Math.ceil(c.workSeconds - inCycle), totalSeconds };
      }
      return { phase: 'rest', round, totalRounds: c.rounds, remaining: Math.ceil(cycle - inCycle), totalSeconds };
    }
  }
}

export function describeInterval(c: IntervalConfig): string {
  switch (c.mode) {
    case 'emom':
      return `EMOM ${c.minutes} min${c.repsPerMinute ? ` · ${c.repsPerMinute} Wdh./min` : ''}`;
    case 'amrap':
      return `AMRAP ${c.minutes} min`;
    case 'tabata':
      return `Intervall ${c.rounds} × ${c.workSeconds}s / ${c.restSeconds}s`;
  }
}

export const DEFAULT_INTERVALS: Record<IntervalConfig['mode'], IntervalConfig> = {
  emom: { mode: 'emom', minutes: 10, repsPerMinute: 10 },
  amrap: { mode: 'amrap', minutes: 12 },
  tabata: { mode: 'tabata', workSeconds: 20, restSeconds: 10, rounds: 8 },
};
