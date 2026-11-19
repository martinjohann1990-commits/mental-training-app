import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { BarChart, HBarList, StatTile } from '@/components/charts';
import { AppText, Card, Divider, EmptyState, ListRow, Segmented, SectionHeader } from '@/components/ui';
import { MUSCLES } from '@/domain/catalog';
import {
  addWeeks,
  muscleDistribution,
  PR_LABELS,
  prsInWorkout,
  startOfWeek,
  summarizePeriod,
  weeklyBuckets,
  weekStreak,
} from '@/domain/stats';
import { formatHours, formatNumber, formatVolume } from '@/domain/units';
import { useExerciseMap } from '@/hooks/use-exercise-map';
import { useHistory } from '@/hooks/use-history';
import { formatPRValue } from '@/lib/format-pr';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';

type Range = '4w' | '12w' | '52w';
const RANGE_WEEKS: Record<Range, number> = { '4w': 4, '12w': 12, '52w': 52 };

export default function StatsScreen() {
  const history = useHistory();
  const map = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const [range, setRange] = useState<Range>('12w');
  const [now] = useState(() => Date.now());
  const weeks = RANGE_WEEKS[range];

  const data = useMemo(() => {
    if (!history) return null;
    const start = addWeeks(startOfWeek(now), -(weeks - 1));
    const inRange = history.sets.filter((s) => s.startedAt >= start);
    const summary = summarizePeriod(history.sets, history.workouts, start, now + 1);
    const buckets = weeklyBuckets(history.sets, now, weeks);
    const muscles = muscleDistribution(inRange, (id) => {
      const e = map.get(id);
      return e && { primary: e.primaryMuscle, secondary: e.secondaryMuscles };
    }).filter((m) => m.muscle !== 'cardio');
    const recentPRs = [...history.workouts]
      .reverse()
      .slice(0, 30)
      .flatMap((w) => prsInWorkout(history.sets, w.id).map((p) => ({ ...p, date: w.startedAt, workoutId: w.id })))
      .filter((p) => p.kind === 'weight' || p.kind === 'e1rm' || p.kind === 'reps' || p.kind === 'duration')
      .slice(0, 8);
    return { summary, buckets, muscles, recentPRs, streak: weekStreak(history.workouts.map((w) => w.startedAt), now) };
  }, [history, map, weeks, now]);

  if (!history || !data) return null;
  if (history.workouts.length === 0) {
    return <EmptyState icon="chart-line" title="Noch keine Daten" text="Nach deinem ersten gespeicherten Workout erscheinen hier deine Statistiken." />;
  }
  const { summary, buckets, muscles, recentPRs, streak } = data;
  const perWeek = summary.workouts / weeks;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Segmented
        options={[
          { value: '4w', label: '4 Wochen' },
          { value: '12w', label: '12 Wochen' },
          { value: '52w', label: '1 Jahr' },
        ]}
        value={range}
        onChange={setRange}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <StatTile label="Workouts" value={String(summary.workouts)} sub={`Ø ${formatNumber(perWeek, 1)} pro Woche`} />
        <StatTile label="Trainingszeit" value={formatHours(summary.durationSec)} />
        <StatTile label="Volumen" value={formatVolume(summary.volume, unit)} sub={`${summary.sets} Arbeitssätze`} />
        <StatTile label="Serie" value={`${streak} ${streak === 1 ? 'Woche' : 'Wochen'}`} sub="in Folge trainiert" />
      </View>

      <SectionHeader>Rückblicke</SectionHeader>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="calendar-week" title="Diese Woche" onPress={() => router.push({ pathname: '/review', params: { kind: 'week', offset: '0' } })} />
        <Divider />
        <ListRow icon="calendar-arrow-left" title="Letzte Woche" onPress={() => router.push({ pathname: '/review', params: { kind: 'week', offset: '-1' } })} />
        <Divider />
        <ListRow icon="calendar-month" title="Dieser Monat" onPress={() => router.push({ pathname: '/review', params: { kind: 'month', offset: '0' } })} />
        <Divider />
        <ListRow icon="calendar-month-outline" title="Letzter Monat" onPress={() => router.push({ pathname: '/review', params: { kind: 'month', offset: '-1' } })} />
      </Card>

      <SectionHeader>Volumen pro Woche</SectionHeader>
      <Card>
        <BarChart
          accessibilityLabel={`Volumen pro Woche, letzte ${weeks} Wochen`}
          bars={buckets.map((b) => ({ key: String(b.weekStart), value: b.volume }))}
          formatY={(v) => formatVolume(v, unit)}
          formatLabel={(i) => {
            const every = weeks <= 4 ? 1 : weeks <= 12 ? 3 : 13;
            if ((buckets.length - 1 - i) % every !== 0) return null;
            const d = new Date(buckets[i].weekStart);
            return `${d.getDate()}.${d.getMonth() + 1}.`;
          }}
          formatReadout={(i) => {
            const d = new Date(buckets[i].weekStart);
            return `Woche ab ${d.getDate()}.${d.getMonth() + 1}. · ${buckets[i].workouts} Workouts`;
          }}
        />
      </Card>

      <SectionHeader>Muskelgruppen</SectionHeader>
      <Card>
        {muscles.length === 0 ? (
          <AppText muted>Keine Sätze im Zeitraum.</AppText>
        ) : (
          <>
            <HBarList
              rows={muscles.slice(0, 10).map((m) => ({ key: m.muscle, label: MUSCLES[m.muscle], value: m.sets }))}
              formatValue={(v) => `${formatNumber(v, v % 1 ? 1 : 0)} Sätze`}
            />
            <AppText variant="caption" muted>
              Hauptmuskel zählt 1 Satz, Hilfsmuskeln je ½.
            </AppText>
          </>
        )}
      </Card>

      <SectionHeader>Neue Rekorde</SectionHeader>
      <Card style={{ paddingVertical: spacing.xs }}>
        {recentPRs.length === 0 ? (
          <AppText muted style={{ paddingVertical: spacing.md }}>
            Noch keine – Rekorde zählen ab deiner zweiten Einheit einer Übung.
          </AppText>
        ) : (
          recentPRs.map((p, i) => (
            <View key={`${p.workoutId}-${p.exerciseId}-${p.kind}`}>
              {i > 0 && <Divider />}
              <ListRow
                icon="trophy-outline"
                title={`${map.get(p.exerciseId)?.name ?? 'Übung'}: ${formatPRValue(p.kind, p.value, unit)}`}
                subtitle={`${PR_LABELS[p.kind]} · ${new Date(p.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: p.exerciseId } })}
              />
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
