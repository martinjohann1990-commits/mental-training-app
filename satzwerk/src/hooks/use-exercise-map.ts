import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { allExercisesWithArchivedQuery } from '@/db/repo/exercises';
import type { ExerciseRow } from '@/db/schema';

/** Map exerciseId → Übung (inkl. archivierter, damit alte Workouts Namen behalten). */
export function useExerciseMap(): Map<string, ExerciseRow> {
  const { data } = useLiveQuery(allExercisesWithArchivedQuery());
  return useMemo(() => new Map(data.map((e) => [e.id, e])), [data]);
}
