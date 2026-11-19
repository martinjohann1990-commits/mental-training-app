import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { formatSetValues } from '@/components/workout/exercise-card';
import { AppText, Button, Card, EmptyState } from '@/components/ui';
import { createRoutine } from '@/db/repo/routines';
import { deleteWorkout, detailToDraftExercises, getWorkoutDetail, type WorkoutDetail } from '@/db/repo/workouts';
import { describeInterval } from '@/domain/interval';
import { draftToRoutineExercises } from '@/domain/routine';
import { formatDuration, formatWeight } from '@/domain/units';
import { PR_LABELS, prsInWorkout } from '@/domain/stats';
import { fieldsFor, SET_TYPES, setVolume } from '@/domain/workout';
import { useExerciseMap } from '@/hooks/use-exercise-map';
import { useHistory } from '@/hooks/use-history';
import { formatPRValue } from '@/lib/format-pr';
import { confirmAction, notify } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { formatDecimal } from '@/lib/number';
import { startWorkoutFrom } from '@/lib/start-workout';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';

const FEELINGS = ['😫', '😕', '😐', '🙂', '🔥'];
const ENERGY = ['Leer', 'Müde', 'Okay', 'Gut', 'Top'];

export default function WorkoutDetailScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const map = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const [detail, setDetail] = useState<WorkoutDetail | null | undefined>(undefined);
  const history = useHistory();
  const prs = useMemo(() => (history ? prsInWorkout(history.sets, id) : []), [history, id]);

  useEffect(() => {
    let cancelled = false;
    void getWorkoutDetail(id).then((d) => !cancelled && setDetail(d));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (detail === undefined) return null;
  if (detail === null) return <EmptyState icon="alert-circle-outline" title="Workout nicht gefunden" />;

  const durationSec = (detail.endedAt.getTime() - detail.startedAt.getTime()) / 1000;
  const volume = detail.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.type !== 'warmup').reduce((a, s) => a + setVolume(s), 0),
    0,
  );
  const setCount = detail.exercises.reduce((a, e) => a + e.sets.length, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: fresh ? 'Gespeichert ✓' : 'Workout' }} />
      <View>
        <AppText variant="title">{detail.name}</AppText>
        <AppText muted>
          {detail.startedAt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
          {detail.startedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </AppText>
      </View>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {[
          ['Dauer', formatDuration(durationSec)],
          ['Sätze', String(setCount)],
          ['Volumen', formatWeight(volume, unit)],
          ['Rekorde', String(new Set(prs.map((p) => p.exerciseId)).size)],
        ].map(([k, v]) => (
          <View key={k} style={{ alignItems: 'center' }}>
            <AppText variant="caption" muted>
              {k}
            </AppText>
            <AppText variant="heading">{v}</AppText>
          </View>
        ))}
      </Card>

      {(!!detail.rating || !!detail.energy || !!detail.notes) && (
        <Card>
          {(!!detail.rating || !!detail.energy) && (
            <AppText>
              {detail.rating ? `Gefühl ${FEELINGS[detail.rating - 1]}` : ''}
              {detail.rating && detail.energy ? ' · ' : ''}
              {detail.energy ? `Energie: ${ENERGY[detail.energy - 1]}` : ''}
            </AppText>
          )}
          {detail.notes ? <AppText muted>{detail.notes}</AppText> : null}
        </Card>
      )}

      {detail.exercises.map((e) => {
        const info = map.get(e.exerciseId);
        const fields = fieldsFor(info?.loggingType ?? 'weight_reps');
        let n = 0;
        return (
          <Card key={e.id}>
            <AppText variant="heading" accent>
              {info?.name ?? 'Übung'}
            </AppText>
            {e.interval && (
              <AppText variant="caption" muted>
                {describeInterval(e.interval)}
              </AppText>
            )}
            {prs
              .filter((p) => p.exerciseId === e.exerciseId)
              .filter((p) => p.kind !== 'volume' || prs.filter((q) => q.exerciseId === e.exerciseId).length === 1)
              .map((p) => (
                <AppText key={p.kind} variant="caption" style={{ fontWeight: '700' }}>
                  🏆 {PR_LABELS[p.kind]}: {formatPRValue(p.kind, p.value, unit)}
                </AppText>
              ))}
            {e.note ? (
              <AppText variant="caption" muted style={{ fontStyle: 'italic' }}>
                {e.note}
              </AppText>
            ) : null}
            {e.sets.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', gap: spacing.md }}>
                <AppText style={{ width: 28, fontWeight: '800', textAlign: 'center' }}>
                  {s.type === 'normal' ? ++n : SET_TYPES[s.type].short}
                </AppText>
                <AppText style={{ flex: 1 }}>
                  {formatSetValues(s, fields, unit)}
                  {s.rpe !== null ? `  @${formatDecimal(s.rpe)}` : ''}
                </AppText>
                {s.note ? (
                  <AppText variant="caption" muted numberOfLines={1} style={{ maxWidth: 120 }}>
                    {s.note}
                  </AppText>
                ) : null}
              </View>
            ))}
          </Card>
        );
      })}

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Button
          title="Workout wiederholen"
          icon="replay"
          onPress={() => startWorkoutFrom(detail.name, detailToDraftExercises(detail), detail.routineId)}
        />
        <Button
          title="Als Routine speichern"
          icon="content-save-outline"
          variant="secondary"
          onPress={async () => {
            const rid = await createRoutine({
              name: detail.name,
              notes: '',
              folderId: null,
              exercises: draftToRoutineExercises(detailToDraftExercises(detail)),
            });
            notify('Routine gespeichert', `„${detail.name}“ findest du jetzt unter Training → Routinen.`);
            router.push({ pathname: '/routine/[id]', params: { id: rid } });
          }}
        />
        <Button
          title="Workout löschen"
          icon="trash-can-outline"
          variant="danger"
          onPress={() =>
            confirmAction('Workout löschen?', 'Das Workout und alle Sätze werden endgültig gelöscht.', 'Löschen', async () => {
              await deleteWorkout(detail.id);
              goBack('/');
            })
          }
        />
      </View>
    </ScrollView>
  );
}
