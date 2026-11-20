import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

import { allGoalsQuery, markGoalAchieved } from '@/db/repo/goals';
import type { GoalRow } from '@/db/schema';
import { evaluateGoal, type GoalEvaluation } from '@/domain/goals';

import { useBodyData } from './use-body';
import { useHabits } from './use-habits';
import { useHistory } from './use-history';

export type GoalWithEval = GoalRow & { evaluation: GoalEvaluation };

export function useGoals(): { goals: GoalWithEval[]; loaded: boolean } {
  const { data: goals, updatedAt } = useLiveQuery(allGoalsQuery());
  const history = useHistory();
  const { entries } = useBodyData();
  const { habits } = useHabits();
  const [now] = useState(() => Date.now());

  const evaluated = useMemo(() => {
    const habitStreaks = new Map(habits.map((h) => [h.id, { current: h.streak.current, unit: h.streak.unit }]));
    return goals.map((g) => ({
      ...g,
      evaluation: evaluateGoal(g, { history: history?.sets ?? [], measurements: entries, habitStreaks, now }),
    }));
  }, [goals, history, entries, habits, now]);

  // Erreichte Ziele einmalig mit Datum markieren (DB-Schreibzugriff, kein UI-State).
  useEffect(() => {
    for (const g of evaluated) {
      if (g.evaluation.reached && !g.achievedAt) void markGoalAchieved(g.id, new Date());
    }
  }, [evaluated]);

  return { goals: evaluated, loaded: !!updatedAt && history !== null };
}
