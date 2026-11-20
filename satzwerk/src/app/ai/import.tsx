import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ExercisePicker } from '@/components/exercise-picker';
import { FormScrollView, KeyboardScreen } from '@/components/form-scroll';
import { AppText, Button, Card, Chip, ChipRow, Divider, Icon, SectionHeader, Segmented, TextField } from '@/components/ui';
import { saveImportedPlan } from '@/db/repo/ai-import';
import { createCustomExercise } from '@/db/repo/exercises';
import { allFoldersQuery } from '@/db/repo/routines';
import { matchExercise, parsePlanResponse, type ParsedExercise, type ParsedPlan, toRoutineExercise } from '@/domain/ai-plan';
import { useAIContext } from '@/hooks/use-ai-context';
import { useExerciseMap } from '@/hooks/use-exercise-map';
import { notify } from '@/lib/confirm';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

type Resolution = { kind: 'match'; id: string } | { kind: 'create' } | { kind: 'skip' };
const keyOf = (ri: number, ei: number) => `${ri}-${ei}`;

export default function AIImportScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ mode?: string; folderId?: string }>();
  const reviseFolder = params.mode === 'revise' ? params.folderId || null : null;
  const ctx = useAIContext();
  const map = useExerciseMap();
  const { data: folders } = useLiveQuery(allFoldersQuery());
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ParsedPlan | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [res, setRes] = useState<Record<string, Resolution>>({});
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<'replace' | 'new'>(reviseFolder ? 'replace' : 'new');
  const [saving, setSaving] = useState(false);

  const library = useMemo(() => ctx.exercises.map((e) => ({ id: e.id, name: e.name })), [ctx.exercises]);
  const matches = useMemo(() => {
    const m: Record<string, ReturnType<typeof matchExercise>> = {};
    plan?.routines.forEach((r, ri) => r.exercises.forEach((e, ei) => (m[keyOf(ri, ei)] = matchExercise(e.name, library))));
    return m;
  }, [plan, library]);

  function check() {
    const r = parsePlanResponse(text);
    if (!r.ok) {
      setError(r.error);
      setPlan(null);
      return;
    }
    setError(null);
    setPlan(r.plan);
    setWarnings(r.warnings);
    setPlanName(r.plan.name);
    // Standard: sichere Treffer übernehmen, Rest neu anlegen.
    const init: Record<string, Resolution> = {};
    r.plan.routines.forEach((rt, ri) =>
      rt.exercises.forEach((e, ei) => {
        const m = matchExercise(e.name, library);
        init[keyOf(ri, ei)] = m.id ? { kind: 'match', id: m.id } : { kind: 'create' };
      }),
    );
    setRes(init);
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    try {
      const created = new Map<string, string>(); // gleiche neue Übung nur einmal anlegen
      const routines = [];
      for (const [ri, r] of plan.routines.entries()) {
        const exercises = [];
        for (const [ei, e] of r.exercises.entries()) {
          const choice = res[keyOf(ri, ei)] ?? { kind: 'create' };
          if (choice.kind === 'skip') continue;
          let id: string;
          if (choice.kind === 'match') id = choice.id;
          else {
            const k = e.name.toLowerCase();
            id = created.get(k) ?? (await createFromAI(e));
            created.set(k, id);
          }
          const info = map.get(id) ?? ctx.exercises.find((x) => x.id === id);
          const loggingType = info?.loggingType ?? e.newExercise?.loggingType ?? (e.durationSec && !e.repsMin ? 'duration' : 'weight_reps');
          exercises.push(toRoutineExercise(e, id, loggingType, ctx.weightOptionsFor(info?.equipment ?? e.newExercise?.equipment ?? [])));
        }
        routines.push({ name: r.name, notes: r.notes, exercises });
      }
      await saveImportedPlan({
        planName: planName.trim() || plan.name,
        routines,
        mode: reviseFolder && saveMode === 'replace' ? 'replace' : 'new',
        folderId: reviseFolder,
      });
      notify('Plan gespeichert', `${routines.length} Routinen liegen jetzt im Training-Tab.`);
      router.dismissAll();
      router.replace('/');
    } finally {
      setSaving(false);
    }
  }

  const summaryCounts = useMemo(() => {
    const v = Object.values(res);
    return { match: v.filter((x) => x.kind === 'match').length, create: v.filter((x) => x.kind === 'create').length, skip: v.filter((x) => x.kind === 'skip').length };
  }, [res]);

  return (
    <KeyboardScreen>
      <Stack.Screen options={{ title: 'KI-Plan importieren' }} />
      <FormScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 64 }}>
        {!plan ? (
          <>
            <AppText muted>Füge die komplette Antwort der KI ein (Text drumherum ist egal).</AppText>
            <TextField
              accessibilityLabel="KI-Antwort"
              value={text}
              onChangeText={setText}
              multiline
              placeholder='{"plan_name": …, "routines": [ … ] }'
              style={{ minHeight: 220, fontSize: 13 }}
            />
            {error && <AppText style={{ color: c.danger }}>{error}</AppText>}
            <Button title="Plan prüfen" icon="magnify-scan" disabled={!text.trim()} onPress={check} />
          </>
        ) : (
          <>
            <TextField label="Name des Plans (Ordner)" value={planName} onChangeText={setPlanName} />
            {plan.summary ? (
              <Card>
                <AppText variant="label" muted>
                  Zusammenfassung der KI
                </AppText>
                <AppText>{plan.summary}</AppText>
              </Card>
            ) : null}
            {plan.changes ? (
              <Card>
                <AppText variant="label" muted>
                  Änderungen
                </AppText>
                <AppText>{plan.changes}</AppText>
              </Card>
            ) : null}
            {warnings.map((w) => (
              <AppText key={w} variant="caption" style={{ color: c.danger }}>
                ⚠ {w}
              </AppText>
            ))}
            <AppText variant="caption" muted>
              {summaryCounts.match} zugeordnet · {summaryCounts.create} neu · {summaryCounts.skip} weggelassen
            </AppText>

            {plan.routines.map((r, ri) => (
              <View key={ri} style={{ gap: spacing.sm }}>
                <SectionHeader>{r.name}</SectionHeader>
                <Card style={{ paddingVertical: spacing.xs }}>
                  {r.exercises.map((e, ei) => {
                    const k = keyOf(ri, ei);
                    const choice = res[k] ?? { kind: 'create' };
                    const m = matches[k];
                    const matchedName = choice.kind === 'match' ? map.get(choice.id)?.name : null;
                    return (
                      <View key={k} style={{ paddingVertical: spacing.sm, gap: 6 }}>
                        {ei > 0 && <Divider />}
                        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                          <Icon
                            name={choice.kind === 'match' ? 'check-circle' : choice.kind === 'skip' ? 'minus-circle-outline' : 'plus-circle-outline'}
                            size={20}
                            color={choice.kind === 'match' ? c.success : c.textMuted}
                          />
                          <View style={{ flex: 1 }}>
                            <AppText style={{ fontWeight: '600', textDecorationLine: choice.kind === 'skip' ? 'line-through' : 'none' }}>{e.name}</AppText>
                            <AppText variant="caption" muted>
                              {describeParsed(e)}
                              {choice.kind === 'match' && matchedName && matchedName !== e.name ? ` · → ${matchedName}` : ''}
                              {choice.kind === 'create' ? ' · wird als eigene Übung angelegt' : ''}
                            </AppText>
                          </View>
                        </View>
                        {choice.kind !== 'match' || (m && !m.id) ? (
                          <ChipRow>
                            {m?.suggestions
                              .filter((s) => !(choice.kind === 'match' && choice.id === s.id))
                              .map((s) => (
                                <Chip key={s.id} label={s.name} onPress={() => setRes((x) => ({ ...x, [k]: { kind: 'match', id: s.id } }))} />
                              ))}
                            <Chip label="Andere…" icon="magnify" onPress={() => setPickFor(k)} />
                            {choice.kind !== 'create' && <Chip label="Neu anlegen" onPress={() => setRes((x) => ({ ...x, [k]: { kind: 'create' } }))} />}
                            {choice.kind !== 'skip' && <Chip label="Weglassen" onPress={() => setRes((x) => ({ ...x, [k]: { kind: 'skip' } }))} />}
                          </ChipRow>
                        ) : (
                          <ChipRow>
                            <Chip label="Ändern…" icon="swap-horizontal" onPress={() => setPickFor(k)} />
                            <Chip label="Weglassen" onPress={() => setRes((x) => ({ ...x, [k]: { kind: 'skip' } }))} />
                          </ChipRow>
                        )}
                      </View>
                    );
                  })}
                </Card>
              </View>
            ))}

            {reviseFolder && (
              <>
                <SectionHeader>Speichern als</SectionHeader>
                <Segmented
                  options={[
                    { value: 'replace', label: `„${folders.find((f) => f.id === reviseFolder)?.name ?? 'Plan'}“ ersetzen` },
                    { value: 'new', label: 'Neuer Ordner' },
                  ]}
                  value={saveMode}
                  onChange={setSaveMode}
                />
                <AppText variant="caption" muted>
                  Bisherige Workouts bleiben in jedem Fall erhalten.
                </AppText>
              </>
            )}
            <Button title={saving ? 'Speichern …' : 'Plan speichern'} icon="content-save-outline" disabled={saving} onPress={() => void save()} />
            <Button title="Andere Antwort einfügen" variant="ghost" onPress={() => setPlan(null)} />
          </>
        )}
      </FormScrollView>
      <ExercisePicker
        visible={!!pickFor}
        onClose={() => setPickFor(null)}
        onPick={(id) => {
          if (pickFor) setRes((x) => ({ ...x, [pickFor]: { kind: 'match', id } }));
          setPickFor(null);
        }}
      />
    </KeyboardScreen>
  );
}

function describeParsed(e: ParsedExercise): string {
  const parts: string[] = [];
  const reps = e.repsText ?? (e.repsMin ? String(e.repsMin) : null);
  if (e.durationSec && !reps) parts.push(`${e.sets} × ${e.durationSec} s`);
  else parts.push(`${e.sets} × ${reps ?? '?'}`);
  if (e.warmupSets) parts.push(`+${e.warmupSets} Aufw.`);
  if (e.weightKg) parts.push(`${String(e.weightKg).replace('.', ',')} kg`);
  if (e.supersetGroup) parts.push(`Supersatz ${e.supersetGroup}`);
  if (e.interval) parts.push(e.interval.mode.toUpperCase());
  return parts.join(' · ');
}

/** Neue eigene Übung aus den KI-Metadaten (oder sinnvollen Standards). */
async function createFromAI(e: ParsedExercise): Promise<string> {
  const meta = e.newExercise;
  return createCustomExercise({
    name: e.name,
    primaryMuscle: meta?.primaryMuscle ?? 'full_body',
    secondaryMuscles: [],
    equipment: meta?.equipment ?? [],
    loggingType: meta?.loggingType ?? (e.durationSec && !e.repsMin ? 'duration' : 'weight_reps'),
    instructions: e.notes,
    complexParts: null,
  });
}
