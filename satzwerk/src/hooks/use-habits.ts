import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';

import { allHabitLogsQuery, allHabitsQuery } from '@/db/repo/habits';
import { workoutStartsQuery } from '@/db/repo/workouts';
import type { HabitRow } from '@/db/schema';
import { dayKey } from '@/domain/body';
import { type HabitValues, streakInfo, type StreakInfo } from '@/domain/habits';

export type HabitWithStats = HabitRow & { values: HabitValues; streak: StreakInfo; todayValue: number };

/** Alle Gewohnheiten mit Tageswerten und Serien. Trainingsfrequenz zählt gespeicherte Workouts. */
export function useHabits(): { habits: HabitWithStats[]; today: string; loaded: boolean } {
  const { data: habits, updatedAt } = useLiveQuery(allHabitsQuery());
  const { data: logs } = useLiveQuery(allHabitLogsQuery());
  const { data: starts } = useLiveQuery(workoutStartsQuery());
  const [today] = useState(() => dayKey(Date.now()));

  const result = useMemo(() => {
    const workoutDays: HabitValues = new Map();
    for (const w of starts) {
      const k = dayKey(w.startedAt);
      workoutDays.set(k, (workoutDays.get(k) ?? 0) + 1);
    }
    return habits.map((h) => {
      const values: HabitValues =
        h.kind === 'workouts' ? workoutDays : new Map(logs.filter((l) => l.habitId === h.id).map((l) => [l.day, l.value]));
      const since = dayKey(h.createdAt);
      return { ...h, values, streak: streakInfo(h, values, today, since < today ? since : undefined), todayValue: values.get(today) ?? 0 };
    });
  }, [habits, logs, starts, today]);

  return { habits: result, today, loaded: !!updatedAt };
}
