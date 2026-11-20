import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppText, Button, Chip, ChipRow, EmptyState, Segmented, SectionHeader, TextField, ToggleRow } from '@/components/ui';
import { allHabitsQuery, createHabit, deleteHabit, type HabitInput, updateHabit, validateHabit } from '@/db/repo/habits';
import type { HabitRow } from '@/db/schema';
import { confirmAction } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { formatDecimal, parseDecimal } from '@/lib/number';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

const PRESETS: (Partial<HabitInput> & { name: string })[] = [
  { name: 'Dehnen / Mobility', kind: 'check' },
  { name: 'Wasser', kind: 'number', dailyTarget: 3, unit: 'l' },
  { name: 'Schritte', kind: 'number', dailyTarget: 10000, unit: '' },
  { name: 'Protein', kind: 'number', dailyTarget: 160, unit: 'g' },
  { name: 'Schlaf', kind: 'number', dailyTarget: 8, unit: 'h' },
  { name: 'Training', kind: 'workouts', timesPerWeek: 4, frequency: 'weekly' },
];

export default function HabitEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: habits, updatedAt } = useLiveQuery(allHabitsQuery());
  const existing = id ? habits.find((h) => h.id === id) : undefined;
  if (id && !existing) return updatedAt ? <EmptyState icon="alert-circle-outline" title="Gewohnheit nicht gefunden" /> : null;
  return <HabitForm key={id ?? 'new'} existing={existing ?? null} />;
}

function HabitForm({ existing }: { existing: HabitRow | null }) {
  const c = useColors();
  const [form, setForm] = useState<HabitInput>(() => ({
    name: existing?.name ?? '',
    kind: existing?.kind ?? 'check',
    dailyTarget: existing?.dailyTarget ?? null,
    unit: existing?.unit ?? '',
    frequency: existing?.frequency ?? 'daily',
    timesPerWeek: existing?.timesPerWeek ?? 3,
    reminderTime: existing?.reminderTime ?? null,
  }));
  const [targetText, setTargetText] = useState(form.dailyTarget ? formatDecimal(form.dailyTarget) : '');
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof HabitInput>(k: K, v: HabitInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const input = { ...form, dailyTarget: form.kind === 'number' ? parseDecimal(targetText) : null };
    const msg = validateHabit(input);
    if (msg) {
      setError(msg);
      return;
    }
    if (existing) await updateHabit(existing.id, input);
    else await createHabit(input);
    goBack('/habits');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit' }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
        {!existing && (
          <>
            <SectionHeader>Vorlagen</SectionHeader>
            <ChipRow>
              {PRESETS.map((p) => (
                <Chip
                  key={p.name}
                  label={p.name}
                  onPress={() => {
                    setForm((f) => ({ ...f, ...p, frequency: p.frequency ?? 'daily', unit: p.unit ?? '', dailyTarget: p.dailyTarget ?? null }));
                    setTargetText(p.dailyTarget ? formatDecimal(p.dailyTarget) : '');
                  }}
                />
              ))}
            </ChipRow>
          </>
        )}

        <TextField label="Name" value={form.name} onChangeText={(t) => set('name', t)} placeholder="z. B. Dehnen, Wasser, Kein Alkohol" maxLength={40} />

        <SectionHeader>Art</SectionHeader>
        <Segmented
          options={[
            { value: 'check', label: 'Ja/Nein' },
            { value: 'number', label: 'Zahl' },
            { value: 'workouts', label: 'Training' },
          ]}
          value={form.kind}
          onChange={(k) => set('kind', k)}
        />
        {form.kind === 'workouts' && (
          <AppText variant="caption" muted>
            Wird automatisch aus deinen gespeicherten Workouts erfüllt.
          </AppText>
        )}

        {form.kind === 'number' && (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Tagesziel" keyboardType="decimal-pad" value={targetText} onChangeText={setTargetText} placeholder="z. B. 3" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Einheit (optional)" value={form.unit} onChangeText={(t) => set('unit', t)} placeholder="l, g, h …" maxLength={8} />
            </View>
          </View>
        )}

        {form.kind !== 'workouts' && (
          <>
            <SectionHeader>Häufigkeit</SectionHeader>
            <Segmented
              options={[
                { value: 'daily', label: 'Täglich' },
                { value: 'weekly', label: 'x-mal pro Woche' },
              ]}
              value={form.frequency}
              onChange={(f) => set('frequency', f)}
            />
          </>
        )}
        {(form.frequency === 'weekly' || form.kind === 'workouts') && (
          <ChipRow>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Chip key={n} label={`${n}×`} selected={form.timesPerWeek === n} onPress={() => set('timesPerWeek', n)} />
            ))}
          </ChipRow>
        )}

        <SectionHeader>Erinnerung</SectionHeader>
        <ToggleRow
          label="Tägliche Erinnerung"
          hint="Benachrichtigung zur gewählten Uhrzeit"
          value={form.reminderTime !== null}
          onChange={(v) => set('reminderTime', v ? '20:00' : null)}
        />
        {form.reminderTime !== null && (
          <TextField label="Uhrzeit (HH:MM)" value={form.reminderTime} onChangeText={(t) => set('reminderTime', t)} keyboardType="numbers-and-punctuation" maxLength={5} />
        )}

        {error && <AppText style={{ color: c.danger }}>{error}</AppText>}
        <Button title="Speichern" icon="check" onPress={() => void save()} />
        {existing && (
          <Button
            title="Gewohnheit löschen"
            icon="trash-can-outline"
            variant="danger"
            onPress={() =>
              confirmAction('Gewohnheit löschen?', `„${existing.name}“ und alle Einträge werden gelöscht.`, 'Löschen', async () => {
                await deleteHabit(existing.id);
                router.replace('/habits');
              })
            }
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
