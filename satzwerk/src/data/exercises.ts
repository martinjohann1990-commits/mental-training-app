import type { ExerciseDefinition } from '@/domain/catalog';

import { KETTLEBELL_EXERCISES } from './exercises-kettlebell';
import { STANDARD_EXERCISES } from './exercises-standard';

/** Alle mitgelieferten Übungen. IDs sind stabil – nie ändern, nur hinzufügen. */
export const BUILTIN_EXERCISES: ExerciseDefinition[] = [...STANDARD_EXERCISES, ...KETTLEBELL_EXERCISES];
