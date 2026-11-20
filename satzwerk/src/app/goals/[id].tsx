import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { LineChart, StatTile } from '@/components/charts';
import { forecastText, formatGoalValue, ProgressBar } from '@/components/habits-goals';
import { AppText, Button, Card, EmptyState } from '@/components/ui';
import { dayKey, formatDay } from '@/domain/body';
import { requiredPerWeek } from '@/domain/goals';
import { useBodyData } from '@/hooks/use-body';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

export default function GoalDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unit = useSettings((s) => s.unit);
  const { goals, loaded } = useGoals();
  const { fields } = useBodyData();
  const { habits } = useHabits();
  const [now] = useState(() => Date.now());
  const g = goals.find((x) => x.id === id);
  if (!loaded) return null;
  if (!g) return <EmptyState icon="alert-circle-outline" title="Ziel nicht gefunden" />;

  const e = g.evaluation;
  const measureUnit = fields.find((f) => f.key === g.refId)?.unit;
  const habitUnit = habits.find((h) => h.id === g.refId)?.streak.unit;
  const fmt = (v: number) => formatGoalValue(g, v, unit, measureUnit, habitUnit);
  const deadline = g.deadline ? new Date(`${g.deadline}T12:00:00`).getTime() : null;
  const perWeek = g.type !== 'habit' ? requiredPerWeek(g.targetValue, e.current, now, deadline) : null;
  const remaining = e.current !== null ? g.targetValue - e.current : null;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: 'Ziel' }} />
      <AppText variant="title">{g.title}</AppText>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText muted>Fortschritt</AppText>
          <AppText style={{ fontWeight: '800' }}>{Math.round(e.progress * 100)} %</AppText>
        </View>
        <ProgressBar value={e.progress} done={e.reached} />
        <AppText style={{ color: e.reached ? c.success : c.text }}>{forecastText(e.forecast)}</AppText>
        {g.achievedAt && (
          <AppText variant="caption" muted>
            Erreicht am {g.achievedAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </AppText>
        )}
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <StatTile label="Start" value={fmt(g.startValue)} sub={formatDay(dayKey(g.createdAt), false)} />
        <StatTile label="Aktuell" value={e.current !== null ? fmt(e.current) : '–'} />
        <StatTile label="Ziel" value={fmt(g.targetValue)} sub={g.deadline ? `bis ${formatDay(g.deadline, false)}` : null} />
        <StatTile
          label="Noch"
          value={remaining !== null && !e.reached ? fmt(Math.abs(remaining)) : '–'}
          sub={perWeek !== null && !e.reached ? `≈ ${fmt(Math.abs(perWeek))} pro Woche nötig` : null}
        />
      </View>
      {e.points.length >= 2 && (
        <Card>
          <LineChart
            accessibilityLabel={`Verlauf zu Ziel ${g.title}`}
            points={e.points.map((p) => ({ x: p.t, y: p.value }))}
            target={g.targetValue}
            formatY={fmt}
            formatX={(x) => new Date(x).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
          />
        </Card>
      )}
      {g.type === 'strength' && g.metric === 'weight' && (
        <AppText variant="caption" muted>
          Zählt das schwerste Gewicht, das du mit mindestens {g.targetReps} Wdh. geschafft hast (Aufwärmsätze ausgenommen).
        </AppText>
      )}
      <Button title="Bearbeiten" icon="pencil-outline" variant="secondary" onPress={() => router.push({ pathname: '/goals/edit', params: { id: g.id } })} />
    </ScrollView>
  );
}
