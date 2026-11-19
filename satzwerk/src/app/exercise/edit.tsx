import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { ExercisePicker } from '@/components/exercise-picker';
import { EQUIPMENT_ICONS } from '@/components/icons';
import { AppText, Button, Card, Chip, ChipRow, EmptyState, Icon, SectionHeader, TextField, ToggleRow } from '@/components/ui';
import {
  allExercisesQuery,
  createCustomExercise,
  type ExerciseInput,
  updateCustomExercise,
  validateExerciseInput,
} from '@/db/repo/exercises';
import {
  EQUIPMENT,
  EQUIPMENT_KEYS,
  type Equipment,
  LOGGING_TYPE_KEYS,
  LOGGING_TYPES,
  MUSCLE_KEYS,
  MUSCLES,
} from '@/domain/catalog';
import { goBack } from '@/lib/navigation';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

const EMPTY: ExerciseInput = {
  name: '',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: [],
  loggingType: 'weight_reps',
  instructions: '',
  complexParts: null,
};

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export default function EditExerciseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: all, updatedAt } = useLiveQuery(allExercisesQuery());
  const existing = id ? all.find((e) => e.id === id) : undefined;

  // Beim Bearbeiten warten, bis die Übung geladen ist, damit das Formular korrekt vorbelegt wird.
  if (id && !existing) {
    return updatedAt ? <EmptyState icon="alert-circle-outline" title="Übung nicht gefunden" /> : null;
  }
  const initial: ExerciseInput = existing
    ? {
        name: existing.name,
        primaryMuscle: existing.primaryMuscle,
        secondaryMuscles: existing.secondaryMuscles,
        equipment: existing.equipment,
        loggingType: existing.loggingType,
        instructions: existing.instructions,
        complexParts: existing.complexParts ?? null,
      }
    : EMPTY;
  return <ExerciseForm key={id ?? 'new'} id={id} initial={initial} all={all} />;
}

function ExerciseForm({
  id,
  initial,
  all,
}: {
  id?: string;
  initial: ExerciseInput;
  all: { id: string; name: string }[];
}) {
  const c = useColors();
  const [form, setForm] = useState<ExerciseInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const set = <K extends keyof ExerciseInput>(key: K, value: ExerciseInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isComplex = form.complexParts !== null;
  const parts = form.complexParts ?? [];
  const nameOf = (pid: string) => all.find((e) => e.id === pid)?.name ?? pid;

  async function save() {
    const msg = validateExerciseInput(form);
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    try {
      if (id) {
        await updateCustomExercise(id, form);
        goBack('/exercises');
      } else {
        const newId = await createCustomExercise(form);
        router.replace({ pathname: '/exercise/[id]', params: { id: newId } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id ? 'Übung bearbeiten' : 'Neue Übung' }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
        <TextField
          label="Name"
          placeholder="z. B. KB Swing + Squat"
          value={form.name}
          onChangeText={(t) => set('name', t)}
          maxLength={80}
        />

        <SectionHeader>Hauptmuskel</SectionHeader>
        <ChipRow>
          {MUSCLE_KEYS.map((m) => (
            <Chip
              key={m}
              label={MUSCLES[m]}
              selected={form.primaryMuscle === m}
              onPress={() => {
                set('primaryMuscle', m);
                set('secondaryMuscles', form.secondaryMuscles.filter((s) => s !== m));
              }}
            />
          ))}
        </ChipRow>

        <SectionHeader>Sekundäre Muskeln</SectionHeader>
        <ChipRow>
          {MUSCLE_KEYS.filter((m) => m !== form.primaryMuscle).map((m) => (
            <Chip
              key={m}
              label={MUSCLES[m]}
              selected={form.secondaryMuscles.includes(m)}
              onPress={() => set('secondaryMuscles', toggle(form.secondaryMuscles, m))}
            />
          ))}
        </ChipRow>

        <SectionHeader>Benötigtes Equipment</SectionHeader>
        <AppText variant="caption" muted>
          Nichts ausgewählt = reine Körpergewichtsübung.
        </AppText>
        <ChipRow>
          {EQUIPMENT_KEYS.filter((e): e is Exclude<Equipment, 'bodyweight'> => e !== 'bodyweight').map((e) => (
            <Chip
              key={e}
              label={EQUIPMENT[e]}
              icon={EQUIPMENT_ICONS[e]}
              selected={form.equipment.includes(e)}
              onPress={() => set('equipment', toggle(form.equipment, e))}
            />
          ))}
        </ChipRow>

        <SectionHeader>Erfassung</SectionHeader>
        <Card style={{ paddingVertical: spacing.sm }}>
          {LOGGING_TYPE_KEYS.map((t) => {
            const active = form.loggingType === t;
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => set('loggingType', t)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
                <Icon name={active ? 'radiobox-marked' : 'radiobox-blank'} color={active ? c.accent : c.textMuted} />
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '600' }}>{LOGGING_TYPES[t].label}</AppText>
                  <AppText variant="caption" muted>
                    {LOGGING_TYPES[t].hint}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </Card>

        <Card>
          <ToggleRow
            label="Komplex / Flow"
            hint="Mehrere Bewegungen zählen als eine Wiederholung"
            value={isComplex}
            onChange={(v) => set('complexParts', v ? parts : null)}
          />
          {isComplex && (
            <View style={{ gap: spacing.sm }}>
              {parts.map((pid, i) => (
                <View key={`${pid}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <AppText style={{ flex: 1 }}>
                    {i + 1}. {nameOf(pid)}
                  </AppText>
                  <Pressable
                    accessibilityLabel={`${nameOf(pid)} entfernen`}
                    onPress={() => set('complexParts', parts.filter((_, j) => j !== i))}
                    hitSlop={8}>
                    <Icon name="close" color={c.textMuted} />
                  </Pressable>
                </View>
              ))}
              <Button title="Bewegung hinzufügen" icon="plus" variant="secondary" small onPress={() => setPickerOpen(true)} />
            </View>
          )}
        </Card>

        <TextField
          label="Ausführungshinweise (optional)"
          placeholder="Worauf achtest du bei dieser Übung?"
          value={form.instructions}
          onChangeText={(t) => set('instructions', t)}
          multiline
        />

        {error && <AppText style={{ color: c.danger }}>{error}</AppText>}
        <Button title={saving ? 'Speichern …' : 'Speichern'} icon="check" disabled={saving} onPress={save} />
      </ScrollView>

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        excludeIds={id ? [id] : []}
        onPick={(pid) => {
          set('complexParts', [...parts, pid]);
          setPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}
