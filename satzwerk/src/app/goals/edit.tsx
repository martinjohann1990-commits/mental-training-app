import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { ExercisePicker } from '@/components/exercise-picker';
import { AppText, Button, Card, Chip, ChipRow, EmptyState, Segmented, SectionHeader, TextField } from '@/components/ui';
import { allGoalsQuery, createGoal, deleteGoal, type GoalInput, updateGoal, validateGoal } from '@/db/repo/goals';
import type { GoalRow } from '@/db/schema';
import { dayKey, dayToTime, displayUnit, formatDay, fromDisplayMeasure, type MeasureUnit, toDisplayMeasure } from '@/domain/body';
import { type GoalType, strengthPoints } from '@/domain/goals';
import { fromDisplayWeight, toDisplayWeight } from '@/domain/units';
import { useBodyData } from '@/hooks/use-body';
import { useExerciseMap } from '@/hooks/use-exercise-map';
import { useHabits } from '@/hooks/use-habits';
import { useHistory } from '@/hooks/use-history';
import { confirmAction } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { formatDecimal, parseDecimal } from '@/lib/number';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

const DEADLINES = [
  { weeks: 0, label: 'Ohne' },
  { weeks: 4, label: '4 Wo.' },
  { weeks: 8, label: '8 Wo.' },
  { weeks: 12, label: '3 Mon.' },
  { weeks: 26, label: '6 Mon.' },
  { weeks: 52, label: '1 Jahr' },
];

export default function GoalEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: goals, updatedAt } = useLiveQuery(allGoalsQuery());
  const history = useHistory();
  const existing = id ? goals.find((g) => g.id === id) : undefined;
  if (!history || (id && !updatedAt)) return null;
  if (id && !existing) return <EmptyState icon="alert-circle-outline" title="Ziel nicht gefunden" />;
  return <GoalForm key={id ?? 'new'} existing={existing ?? null} history={history.sets} />;
}

function GoalForm({ existing, history }: { existing: GoalRow | null; history: NonNullable<ReturnType<typeof useHistory>>['sets'] }) {
  const c = useColors();
  const unit = useSettings((s) => s.unit);
  const map = useExerciseMap();
  const { fields, entries } = useBodyData();
  const { habits } = useHabits();
  const [today] = useState(() => dayKey(Date.now()));

  const [type, setType] = useState<GoalType>(existing?.type ?? 'strength');
  const [refId, setRefId] = useState<string | null>(existing?.refId ?? null);
  const [metric, setMetric] = useState<'e1rm' | 'weight'>((existing?.metric as 'e1rm' | 'weight') ?? 'weight');
  const [repsText, setRepsText] = useState(String(existing?.targetReps ?? 5));
  const [title, setTitle] = useState(existing?.title ?? '');
  const [deadline, setDeadline] = useState<string | null>(existing?.deadline ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Einheit des gewählten Ziels: Gewicht, Maß oder Serie.
  const measureField = fields.find((f) => f.key === (type === 'bodyweight' ? 'weight' : refId));
  const habit = habits.find((h) => h.id === refId);
  const valueUnit: { kind: 'weight' } | { kind: 'measure'; unit: MeasureUnit } | { kind: 'count'; label: string } =
    type === 'strength'
      ? { kind: 'weight' }
      : type === 'habit'
        ? { kind: 'count', label: habit?.streak.unit ?? 'Tage' }
        : { kind: 'measure', unit: measureField?.unit ?? 'cm' };
  const toDisp = (v: number) =>
    valueUnit.kind === 'weight' ? toDisplayWeight(v, unit) : valueUnit.kind === 'measure' ? toDisplayMeasure(v, valueUnit.unit, unit) : v;
  const fromDisp = (v: number) =>
    valueUnit.kind === 'weight' ? fromDisplayWeight(v, unit) : valueUnit.kind === 'measure' ? fromDisplayMeasure(v, valueUnit.unit, unit) : v;
  const unitLabel = valueUnit.kind === 'weight' ? unit : valueUnit.kind === 'measure' ? displayUnit(valueUnit.unit, unit) : valueUnit.label;

  // Aktueller Stand als Startwert-Vorschlag.
  const effectiveRef = type === 'bodyweight' ? 'weight' : refId;
  const reps = Math.max(1, parseInt(repsText, 10) || 1);
  const currentValue = useMemo(() => {
    if (!effectiveRef) return null;
    if (type === 'strength') {
      const pts = strengthPoints(history, effectiveRef, metric, reps);
      return pts.length ? Math.max(...pts.map((p) => p.value)) : null;
    }
    if (type === 'habit') return habits.find((h) => h.id === effectiveRef)?.streak.current ?? 0;
    const list = entries.filter((e) => e.key === effectiveRef).sort((a, b) => a.day.localeCompare(b.day));
    return list.length ? list[list.length - 1].value : null;
  }, [effectiveRef, type, history, metric, reps, habits, entries]);

  const [startText, setStartText] = useState(existing ? formatDecimal(toDisp(existing.startValue)) : '');
  const [targetText, setTargetText] = useState(existing ? formatDecimal(toDisp(existing.targetValue)) : '');
  const startPlaceholder = currentValue !== null ? formatDecimal(toDisp(currentValue)) : '0';

  const autoTitle = () => {
    const t = targetText || '?';
    if (type === 'strength') {
      const n = refId ? (map.get(refId)?.name ?? 'Übung') : 'Übung';
      return metric === 'weight' ? `${n}: ${t} ${unit} × ${reps}` : `${n}: 1RM ${t} ${unit}`;
    }
    if (type === 'bodyweight') return `Körpergewicht ${t} ${unitLabel}`;
    if (type === 'measurement') return `${measureField?.label ?? 'Maß'} ${t} ${unitLabel}`;
    return `${habit?.name ?? 'Gewohnheit'}: ${t} ${unitLabel} in Folge`;
  };

  async function save() {
    const target = parseDecimal(targetText);
    // Serien zählen immer ab 0; sonst ist der leere Start der aktuelle Stand.
    const start = type === 'habit' ? 0 : startText.trim() ? parseDecimal(startText) : currentValue !== null ? toDisp(currentValue) : 0;
    const input: GoalInput = {
      type,
      title: title.trim() || autoTitle(),
      refId: effectiveRef,
      metric: type === 'strength' ? metric : null,
      targetReps: type === 'strength' && metric === 'weight' ? reps : null,
      startValue: start === null ? NaN : fromDisp(start),
      targetValue: target === null ? NaN : fromDisp(target),
      deadline,
    };
    const msg = validateGoal(input);
    if (msg) {
      setError(msg);
      return;
    }
    if (existing) await updateGoal(existing.id, input);
    else await createGoal(input);
    goBack('/goals');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Ziel bearbeiten' : 'Neues Ziel' }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
        <Segmented
          options={[
            { value: 'strength', label: 'Kraft' },
            { value: 'bodyweight', label: 'Gewicht' },
            { value: 'measurement', label: 'Maß' },
            { value: 'habit', label: 'Serie' },
          ]}
          value={type}
          onChange={(t) => {
            setType(t);
            setRefId(null);
            setStartText('');
            setTargetText('');
          }}
        />

        {type === 'strength' && (
          <>
            <SectionHeader>Übung</SectionHeader>
            <Button title={refId ? (map.get(refId)?.name ?? 'Übung') : 'Übung wählen'} icon="dumbbell" variant="secondary" onPress={() => setPickerOpen(true)} />
            <Segmented
              options={[
                { value: 'weight', label: 'Gewicht × Wdh.' },
                { value: 'e1rm', label: '1RM (geschätzt)' },
              ]}
              value={metric}
              onChange={setMetric}
            />
            {metric === 'weight' && (
              <TextField label="Mindestens Wiederholungen" keyboardType="number-pad" value={repsText} onChangeText={setRepsText} />
            )}
          </>
        )}

        {type === 'measurement' && (
          <>
            <SectionHeader>Maß</SectionHeader>
            <ChipRow>
              {fields
                .filter((f) => f.key !== 'weight')
                .map((f) => (
                  <Chip key={f.key} label={f.label} selected={refId === f.key} onPress={() => setRefId(f.key)} />
                ))}
            </ChipRow>
          </>
        )}

        {type === 'habit' && (
          <>
            <SectionHeader>Gewohnheit</SectionHeader>
            {habits.length === 0 ? (
              <Card>
                <AppText muted>Lege zuerst eine Gewohnheit an.</AppText>
                <Button title="Gewohnheit anlegen" small variant="secondary" onPress={() => router.push('/habits/edit')} />
              </Card>
            ) : (
              <ChipRow>
                {habits.map((h) => (
                  <Chip key={h.id} label={h.name} selected={refId === h.id} onPress={() => setRefId(h.id)} />
                ))}
              </ChipRow>
            )}
            <AppText variant="caption" muted>
              Ziel = so viele {unitLabel} in Folge erfüllt.
            </AppText>
          </>
        )}

        <SectionHeader>Werte</SectionHeader>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {type !== 'habit' && (
          <View style={{ flex: 1 }}>
            <TextField label={`Start (${unitLabel})`} keyboardType="decimal-pad" value={startText} onChangeText={setStartText} placeholder={startPlaceholder} />
          </View>
          )}
          <View style={{ flex: 1 }}>
            <TextField label={`Ziel (${unitLabel})`} keyboardType="decimal-pad" value={targetText} onChangeText={setTargetText} placeholder="z. B. 100" />
          </View>
        </View>
        {currentValue !== null && type !== 'habit' && (
          <AppText variant="caption" muted>
            Aktueller Stand: {formatDecimal(toDisp(currentValue))} {unitLabel} (leerer Start = aktueller Stand)
          </AppText>
        )}

        <SectionHeader>Deadline (optional)</SectionHeader>
        <ChipRow>
          {DEADLINES.map((d) => {
            const day = d.weeks ? dayKey(dayToTime(today) + d.weeks * 7 * 86_400_000) : null;
            return <Chip key={d.label} label={d.label} selected={deadline === day} onPress={() => setDeadline(day)} />;
          })}
        </ChipRow>
        {deadline && (
          <AppText variant="caption" muted>
            Bis {formatDay(deadline)}
          </AppText>
        )}

        <TextField label="Titel (optional)" value={title} onChangeText={setTitle} placeholder={autoTitle()} maxLength={60} />

        {error && <AppText style={{ color: c.danger }}>{error}</AppText>}
        <Button title="Ziel speichern" icon="flag-checkered" onPress={() => void save()} />
        {existing && (
          <Button
            title="Ziel löschen"
            icon="trash-can-outline"
            variant="danger"
            onPress={() =>
              confirmAction('Ziel löschen?', `„${existing.title}“ wird gelöscht.`, 'Löschen', async () => {
                await deleteGoal(existing.id);
                router.replace('/goals');
              })
            }
          />
        )}
      </ScrollView>
      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(exerciseId) => {
          setRefId(exerciseId);
          setPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}
