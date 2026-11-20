import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { FormScrollView, KeyboardScreen } from '@/components/form-scroll';
import { AppText, Button, Card, Chip, ChipRow, SectionHeader, TextField } from '@/components/ui';
import { allFoldersQuery, allRoutinesQuery } from '@/db/repo/routines';
import {
  AI_GOALS,
  AI_LEVELS,
  type AIGoal,
  type AILevel,
  type AIProfile,
  buildPlanPrompt,
  buildRevisePrompt,
  routinesToPlanJson,
  summarizeForRevision,
} from '@/domain/ai-plan';
import { useAIContext } from '@/hooks/use-ai-context';
import { useBodyData } from '@/hooks/use-body';
import { useExerciseMap } from '@/hooks/use-exercise-map';
import { useGoals } from '@/hooks/use-goals';
import { useHistory } from '@/hooks/use-history';
import { shareText } from '@/lib/share-text';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

export default function AIPromptScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const ctx = useAIContext();
  if (!ctx.profile) return null;
  return <PromptForm revise={mode === 'revise'} initial={ctx.profile} ctx={ctx} />;
}

function PromptForm({ revise, initial, ctx }: { revise: boolean; initial: AIProfile; ctx: ReturnType<typeof useAIContext> }) {
  const c = useColors();
  const [p, setP] = useState<AIProfile>(initial);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(6);
  const [prompt, setPrompt] = useState<string | null>(null);
  const { data: folders } = useLiveQuery(allFoldersQuery());
  const { data: routines } = useLiveQuery(allRoutinesQuery());
  const history = useHistory();
  const map = useExerciseMap();
  const { entries } = useBodyData();
  const { goals } = useGoals();
  const [now] = useState(() => Date.now());

  const set = <K extends keyof AIProfile>(k: K, v: AIProfile[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setPrompt(null);
  };
  // Pläne = Ordner mit Routinen; „Ohne Ordner“ als eigener Plan.
  const plans = useMemo(() => {
    const list = folders.map((f) => ({ id: f.id as string | null, name: f.name, routines: routines.filter((r) => r.folderId === f.id) }));
    const loose = routines.filter((r) => !r.folderId);
    if (loose.length) list.push({ id: null, name: 'Routinen ohne Ordner', routines: loose });
    return list.filter((x) => x.routines.length > 0);
  }, [folders, routines]);
  const selectedPlan = plans.find((x) => x.id === folderId) ?? plans[0];

  function generate() {
    ctx.setProfile(p);
    const name = (id: string) => map.get(id)?.name ?? id;
    if (!revise) {
      setPrompt(buildPlanPrompt(p, ctx.equipmentText, ctx.availableNames));
      return;
    }
    if (!selectedPlan || !history) return;
    const summary = summarizeForRevision({
      history: history.sets,
      workouts: history.workouts,
      exerciseName: name,
      bodyweight: entries.filter((e) => e.key === 'weight'),
      goals: goals.filter((g) => !g.evaluation.reached).map((g) => ({ title: g.title, progress: g.evaluation.progress })),
      plannedDaysPerWeek: p.daysPerWeek,
      now,
      weeks,
    });
    const planJson = routinesToPlanJson(selectedPlan.name, selectedPlan.routines, name);
    setPrompt(buildRevisePrompt(p, ctx.equipmentText, planJson, summary, ctx.availableNames));
  }

  return (
    <KeyboardScreen>
      <Stack.Screen options={{ title: revise ? 'Plan überarbeiten' : 'Neuer KI-Plan' }} />
      <FormScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
        {revise && (
          <>
            <SectionHeader>Welcher Plan?</SectionHeader>
            {plans.length === 0 ? (
              <Card>
                <AppText muted>Noch keine Routinen vorhanden. Erstelle zuerst einen Plan.</AppText>
              </Card>
            ) : (
              <ChipRow>
                {plans.map((x) => (
                  <Chip key={x.id ?? 'none'} label={`${x.name} (${x.routines.length})`} selected={selectedPlan?.id === x.id} onPress={() => { setFolderId(x.id); setPrompt(null); }} />
                ))}
              </ChipRow>
            )}
            <SectionHeader>Verlauf einbeziehen</SectionHeader>
            <ChipRow>
              {[4, 6, 8, 12].map((w) => (
                <Chip key={w} label={`${w} Wochen`} selected={weeks === w} onPress={() => { setWeeks(w); setPrompt(null); }} />
              ))}
            </ChipRow>
          </>
        )}

        <SectionHeader>Ziel</SectionHeader>
        <ChipRow>
          {(Object.keys(AI_GOALS) as AIGoal[]).map((g) => (
            <Chip key={g} label={AI_GOALS[g]} selected={p.goal === g} onPress={() => set('goal', g)} />
          ))}
        </ChipRow>
        <SectionHeader>Erfahrung</SectionHeader>
        <ChipRow>
          {(Object.keys(AI_LEVELS) as AILevel[]).map((l) => (
            <Chip key={l} label={AI_LEVELS[l]} selected={p.level === l} onPress={() => set('level', l)} />
          ))}
        </ChipRow>
        <SectionHeader>Tage pro Woche</SectionHeader>
        <ChipRow>
          {[2, 3, 4, 5, 6].map((d) => (
            <Chip key={d} label={`${d}×`} selected={p.daysPerWeek === d} onPress={() => set('daysPerWeek', d)} />
          ))}
        </ChipRow>
        <SectionHeader>Minuten pro Einheit</SectionHeader>
        <ChipRow>
          {[30, 45, 60, 75, 90].map((m) => (
            <Chip key={m} label={`${m} min`} selected={p.minutesPerSession === m} onPress={() => set('minutesPerSession', m)} />
          ))}
        </ChipRow>
        <TextField label="Verletzungen / Einschränkungen" value={p.injuries} onChangeText={(t) => set('injuries', t)} placeholder="z. B. Schulter links, keine Überkopf-Übungen" multiline />
        <TextField label="Wünsche" value={p.wishes} onChangeText={(t) => set('wishes', t)} placeholder="z. B. Fokus Kettlebell, Supersätze, kurze Pausen" multiline />

        <Card>
          <AppText variant="label" muted>
            Equipment (Profil „{ctx.profileName}“)
          </AppText>
          <AppText variant="caption">{ctx.equipmentText}</AppText>
        </Card>

        <Button title="Prompt erzeugen" icon="creation" disabled={revise && (!selectedPlan || !history)} onPress={generate} />

        {prompt && (
          <>
            <SectionHeader>Dein Prompt</SectionHeader>
            <View style={{ gap: spacing.sm }}>
              <Button title="Teilen / Kopieren" icon="share-variant" onPress={() => void shareText(prompt, 'Satzwerk-Prompt')} />
              <AppText variant="caption" muted>
                Im Teilen-Menü direkt die KI-App wählen oder „Kopieren“. Alternativ den Text unten lange drücken und markieren.
              </AppText>
              <TextField value={prompt} multiline editable={false} selectTextOnFocus accessibilityLabel="Erzeugter Prompt" style={{ maxHeight: 260, fontSize: 12, color: c.textMuted }} />
              <Button
                title="Weiter: Antwort einfügen"
                icon="content-paste"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/ai/import',
                    params: revise ? { mode: 'revise', folderId: selectedPlan?.id ?? '' } : { mode: 'new' },
                  })
                }
              />
            </View>
          </>
        )}
      </FormScrollView>
    </KeyboardScreen>
  );
}
