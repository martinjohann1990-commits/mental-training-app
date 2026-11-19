import { router } from 'expo-router';

import type { DraftExercise } from '@/domain/workout';
import { useActiveWorkout } from '@/stores/active-workout';

import { confirmAction } from './confirm';

/** Startet ein Workout; fragt nach, falls bereits eines läuft. */
export function startWorkoutFrom(name: string, exercises: DraftExercise[], routineId: string | null = null): void {
  const go = () => {
    useActiveWorkout.getState().start({ name, routineId, exercises });
    router.push('/workout/active');
  };
  if (useActiveWorkout.getState().draft) {
    confirmAction('Workout läuft bereits', 'Das laufende Workout wird verworfen.', 'Verwerfen & starten', () => {
      useActiveWorkout.getState().discard();
      go();
    });
  } else {
    go();
  }
}
