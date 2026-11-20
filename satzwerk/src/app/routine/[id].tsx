import { FormScrollView, KeyboardScreen } from '@/components/form-scroll';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ExerciseListEditor } from '@/components/workout/exercise-list-editor';
import { AppText, Button, Chip, ChipRow, EmptyState, SectionHeader, TextField } from '@/components/ui';
import { allFoldersQuery, allRoutinesQuery, createRoutine, deleteRoutine, updateRoutine } from '@/db/repo/routines';
import type { RoutineRow } from '@/db/schema';
import { draftToRoutineExercises, routineToDraftExercises } from '@/domain/routine';
import type { DraftExercise } from '@/domain/workout';
import { confirmAction, notify } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { startWorkoutFrom } from '@/lib/start-workout';
import { spacing } from '@/theme/colors';

export default function RoutineScreen() {
  const { id, folderId } = useLocalSearchParams<{ id: string; folderId?: string }>();
  const { data: routines, updatedAt } = useLiveQuery(allRoutinesQuery());
  const isNew = id === 'new';
  const routine = isNew ? null : routines.find((r) => r.id === id);

  if (!isNew && !routine) {
    return updatedAt ? <EmptyState icon="alert-circle-outline" title="Routine nicht gefunden" /> : null;
  }
  return <RoutineForm key={id} routine={routine ?? null} initialFolderId={folderId ?? null} />;
}

function RoutineForm({ routine, initialFolderId }: { routine: RoutineRow | null; initialFolderId: string | null }) {
  const { data: folders } = useLiveQuery(allFoldersQuery());
  const [name, setName] = useState(routine?.name ?? '');
  const [notes, setNotes] = useState(routine?.notes ?? '');
  const [folderId, setFolderId] = useState<string | null>(routine?.folderId ?? initialFolderId);
  const [exercises, setExercises] = useState<DraftExercise[]>(() => routineToDraftExercises(routine?.exercises ?? []));
  const [dirty, setDirty] = useState(!routine);
  const [saving, setSaving] = useState(false);

  const change = (fn: (l: DraftExercise[]) => DraftExercise[]) => {
    setExercises(fn);
    setDirty(true);
  };

  async function save(): Promise<string | null> {
    if (!name.trim()) {
      notify('Name fehlt', 'Bitte gib der Routine einen Namen.');
      return null;
    }
    setSaving(true);
    const input = { name, notes, folderId, exercises: draftToRoutineExercises(exercises) };
    try {
      if (routine) {
        await updateRoutine(routine.id, input);
        setDirty(false);
        return routine.id;
      }
      const newId = await createRoutine(input);
      router.replace({ pathname: '/routine/[id]', params: { id: newId } });
      return newId;
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardScreen>
      <Stack.Screen options={{ title: routine ? 'Routine' : 'Neue Routine' }} />
      <FormScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 64 }}>
        <TextField
          label="Name"
          value={name}
          placeholder="z. B. Push A, KB Ganzkörper"
          onChangeText={(t) => {
            setName(t);
            setDirty(true);
          }}
        />
        {folders.length > 0 && (
          <>
            <SectionHeader>Ordner</SectionHeader>
            <ChipRow>
              <Chip label="Kein Ordner" selected={folderId === null} onPress={() => { setFolderId(null); setDirty(true); }} />
              {folders.map((f) => (
                <Chip key={f.id} label={f.name} selected={folderId === f.id} onPress={() => { setFolderId(f.id); setDirty(true); }} />
              ))}
            </ChipRow>
          </>
        )}
        <TextField
          label="Notizen (optional)"
          value={notes}
          multiline
          onChangeText={(t) => {
            setNotes(t);
            setDirty(true);
          }}
        />

        <SectionHeader>Übungen</SectionHeader>
        <AppText variant="caption" muted>
          Werte sind Vorgaben – beim Workout werden sie vorausgefüllt. Satznummer antippen = Satztyp ändern.
        </AppText>
        <ExerciseListEditor mode="routine" exercises={exercises} onChange={change} />

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button title={saving ? 'Speichern …' : 'Routine speichern'} icon="content-save-outline" disabled={saving || !dirty} onPress={() => void save()} />
          {routine && (
            <Button
              title="Workout starten"
              icon="play"
              variant="secondary"
              disabled={exercises.length === 0}
              onPress={async () => {
                const rid = dirty ? await save() : routine.id;
                if (rid) startWorkoutFrom(name || routine.name, routineToDraftExercises(draftToRoutineExercises(exercises)), rid);
              }}
            />
          )}
          {routine && (
            <Button
              title="Routine löschen"
              icon="trash-can-outline"
              variant="danger"
              onPress={() =>
                confirmAction('Routine löschen?', `„${routine.name}“ wird gelöscht. Bisherige Workouts bleiben erhalten.`, 'Löschen', async () => {
                  await deleteRoutine(routine.id);
                  goBack('/');
                })
              }
            />
          )}
        </View>
      </FormScrollView>
    </KeyboardScreen>
  );
}
