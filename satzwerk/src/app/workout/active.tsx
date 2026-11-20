import { FormScrollView, KeyboardScreen } from '@/components/form-scroll';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseListEditor } from '@/components/workout/exercise-list-editor';
import { RestBar, useNow } from '@/components/workout/rest-bar';
import { AppText, Button, EmptyState, TextField } from '@/components/ui';
import { previousSetsFor } from '@/db/repo/workouts';
import { formatDuration } from '@/domain/units';
import type { SetValues } from '@/domain/workout';
import { workoutSummary } from '@/domain/workout';
import { useExerciseMap } from '@/hooks/use-exercise-map';
import { useKeepScreenOn } from '@/hooks/use-keep-screen-on';
import { confirmAction, notify } from '@/lib/confirm';
import { useActiveWorkout } from '@/stores/active-workout';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

function ElapsedTitle({ startedAt }: { startedAt: number }) {
  const now = useNow(1000);
  return (
    <AppText style={{ fontWeight: '800', fontSize: 18, fontVariant: ['tabular-nums'] }}>
      {formatDuration((now - startedAt) / 1000)}
    </AppText>
  );
}

export default function ActiveWorkoutScreen() {
  useKeepScreenOn();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const map = useExerciseMap();
  const store = useActiveWorkout();
  const draft = store.draft;
  const [previous, setPrevious] = useState<Record<string, SetValues[]>>({});

  const exerciseIds = useMemo(() => (draft?.exercises ?? []).map((e) => e.exerciseId).sort().join(','), [draft?.exercises]);
  useEffect(() => {
    let cancelled = false;
    if (!exerciseIds) return;
    void previousSetsFor(exerciseIds.split(',')).then((p) => !cancelled && setPrevious(p));
    return () => {
      cancelled = true;
    };
  }, [exerciseIds]);

  if (!draft) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: 'Workout' }} />
        <EmptyState icon="dumbbell" title="Kein laufendes Workout" text="Starte ein Workout im Tab „Training“." />
        <View style={{ padding: spacing.lg }}>
          <Button title="Zum Training" onPress={() => router.replace('/')} />
        </View>
      </View>
    );
  }

  const summary = workoutSummary(draft);

  /** Name der Übung, mit der es nach der Pause weitergeht (für die Benachrichtigung). */
  const nextExerciseName = (exKey: string, setKey: string) => {
    const i = draft.exercises.findIndex((e) => e.key === exKey);
    const ex = draft.exercises[i];
    if (!ex) return undefined;
    let target = ex;
    if (ex.supersetGroup !== null) {
      // Nach der Runde geht es mit der ersten Übung der Gruppe weiter.
      target = draft.exercises.find((e) => e.supersetGroup === ex.supersetGroup) ?? ex;
    } else if (ex.sets.every((s) => s.completed || s.key === setKey)) {
      target = draft.exercises[i + 1] ?? ex;
    }
    return map.get(target.exerciseId)?.name;
  };

  return (
    <KeyboardScreen>
      <Stack.Screen
        options={{
          headerTitle: () => <ElapsedTitle startedAt={draft.startedAt} />,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Workout beenden"
              onPress={() => {
                if (summary.sets === 0) {
                  notify('Noch keine Sätze', 'Hake mindestens einen Satz ab oder verwirf das Workout.');
                  return;
                }
                router.push('/workout/finish');
              }}
              style={[styles.finish, { backgroundColor: c.accent }]}>
              <AppText style={{ color: c.onAccent, fontWeight: '800' }}>Beenden</AppText>
            </Pressable>
          ),
        }}
      />
      <FormScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 140 }}>
        <TextField value={draft.name} onChangeText={store.rename} accessibilityLabel="Name des Workouts" style={{ fontWeight: '700', fontSize: 18 }} />
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <AppText muted>{summary.sets} Sätze</AppText>
          <AppText muted>{Math.round(summary.volume)} kg Volumen</AppText>
        </View>

        <ExerciseListEditor
          mode="workout"
          exercises={draft.exercises}
          onChange={store.setExercises}
          previous={previous}
          onToggleSet={(exKey, setKey) => {
            const ex = draft.exercises.find((e) => e.key === exKey);
            if (!ex) return;
            const info = map.get(ex.exerciseId);
            const idx = ex.sets.findIndex((s) => s.key === setKey);
            const fallback = previous[ex.exerciseId]?.[idx] ?? null;
            const ok = store.toggleSet(exKey, setKey, info?.loggingType ?? 'weight_reps', fallback, nextExerciseName(exKey, setKey));
            if (!ok) notify('Satz leer', 'Trage zuerst Wiederholungen bzw. Zeit ein.');
          }}
          onIntervalResult={(exKey, config, reps) => store.applyInterval(exKey, config, reps)}
        />

        <Button
          title="Workout verwerfen"
          icon="trash-can-outline"
          variant="danger"
          onPress={() =>
            confirmAction('Workout verwerfen?', 'Alle Eingaben dieses Workouts gehen verloren.', 'Verwerfen', () => {
              store.discard();
              router.replace('/');
            })
          }
        />
      </FormScrollView>

      {draft.rest && (
        <View style={[styles.restWrap, { bottom: Math.max(insets.bottom, spacing.md) }]}>
          <RestBar rest={draft.rest} onAdjust={store.adjustRest} onSkip={store.skipRest} />
        </View>
      )}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  finish: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginRight: 8 },
  restWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
});
