import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, Card, EmptyState, SectionHeader, TextField } from '@/components/ui';
import { saveWorkout } from '@/db/repo/workouts';
import { formatDuration, formatWeight } from '@/domain/units';
import { workoutSummary } from '@/domain/workout';
import { useActiveWorkout } from '@/stores/active-workout';
import { useSettings } from '@/stores/settings';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

const FEELINGS = ['😫', '😕', '😐', '🙂', '🔥'];
const ENERGY = ['Leer', 'Müde', 'Okay', 'Gut', 'Top'];

function Scale({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {options.map((o, i) => {
          const v = i + 1;
          const active = value === v;
          return (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${label}: ${v} von 5`}
              onPress={() => onChange(active ? null : v)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 10,
                borderRadius: radius.md,
                backgroundColor: active ? c.accentMuted : c.surfaceAlt,
                borderWidth: 1,
                borderColor: active ? c.accent : 'transparent',
              }}>
              <AppText style={{ fontSize: o.length <= 2 ? 22 : 13, fontWeight: '700' }}>{o}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function FinishWorkoutScreen() {
  const draft = useActiveWorkout((s) => s.draft);
  const discard = useActiveWorkout((s) => s.discard);
  const unit = useSettings((s) => s.unit);
  const [name, setName] = useState(draft?.name ?? '');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [endedAt] = useState(() => Date.now());

  if (!draft) return <EmptyState icon="check-circle-outline" title="Kein laufendes Workout" />;
  const summary = workoutSummary(draft);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Workout abschließen' }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {[
            ['Dauer', formatDuration((endedAt - draft.startedAt) / 1000)],
            ['Sätze', String(summary.sets)],
            ['Volumen', formatWeight(summary.volume, unit)],
          ].map(([k, v]) => (
            <View key={k} style={{ alignItems: 'center' }}>
              <AppText variant="caption" muted>
                {k}
              </AppText>
              <AppText variant="heading">{v}</AppText>
            </View>
          ))}
        </Card>

        <TextField label="Name" value={name} onChangeText={setName} />
        <SectionHeader>Wie war’s?</SectionHeader>
        <Scale label="Gefühl" options={FEELINGS} value={rating} onChange={setRating} />
        <Scale label="Energie" options={ENERGY} value={energy} onChange={setEnergy} />
        <TextField
          label="Notizen (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Schlaf, Stress, was lief gut, was nicht?"
        />
        <AppText variant="caption" muted>
          Nicht abgehakte Sätze werden nicht gespeichert.
        </AppText>
        <Button
          title={saving ? 'Speichern …' : 'Workout speichern'}
          icon="check"
          disabled={saving}
          onPress={async () => {
            setSaving(true);
            const id = await saveWorkout(draft, { name, notes, rating, energy }, endedAt);
            discard();
            router.dismissAll();
            router.replace({ pathname: '/workout/[id]', params: { id, fresh: '1' } });
          }}
        />
        <Button title="Zurück zum Workout" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
