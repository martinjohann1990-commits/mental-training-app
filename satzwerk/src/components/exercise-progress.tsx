import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { LoggingType } from '@/domain/catalog';
import { exerciseSessions, type ExerciseSession, personalRecords, PR_LABELS, type PRKind } from '@/domain/stats';
import { formatDuration, formatNumber, formatVolume, formatWeight } from '@/domain/units';
import { fieldsFor } from '@/domain/workout';
import { useHistory } from '@/hooks/use-history';
import { formatPRValue } from '@/lib/format-pr';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';

import { LineChart, StatTile } from './charts';
import { AppText, Card, Chip, ChipRow, Divider, SectionHeader } from './ui';
import { formatSetValues } from './workout/exercise-card';

type Metric = { key: PRKind; label: string; pick: (s: ExerciseSession) => number | null };

function metricsFor(t: LoggingType): Metric[] {
  const e1rm: Metric = { key: 'e1rm', label: '1RM (geschätzt)', pick: (s) => s.best1RM };
  const weight: Metric = { key: 'weight', label: 'Max. Gewicht', pick: (s) => s.maxWeight };
  const volume: Metric = { key: 'volume', label: 'Volumen', pick: (s) => s.volume || null };
  const reps: Metric = { key: 'reps', label: 'Max. Wdh.', pick: (s) => s.maxReps };
  const duration: Metric = { key: 'duration', label: 'Max. Dauer', pick: (s) => s.maxDuration };
  const distance: Metric = { key: 'distance', label: 'Max. Distanz', pick: (s) => s.maxDistance };
  switch (t) {
    case 'weight_reps':
    case 'reps_per_side':
      return [e1rm, weight, volume, reps];
    case 'bodyweight_reps':
      return [reps, weight, volume];
    case 'duration':
      return [duration];
    case 'weight_duration_distance':
      return [distance, duration, weight];
  }
}

/** Verlauf, Chart und Rekorde einer Übung. */
export function ExerciseProgress({ exerciseId, loggingType }: { exerciseId: string; loggingType: LoggingType }) {
  const history = useHistory();
  const unit = useSettings((s) => s.unit);
  const metrics = metricsFor(loggingType);
  const [metricKey, setMetricKey] = useState<PRKind>(metrics[0].key);
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const [showAll, setShowAll] = useState(false);

  const sessions = useMemo(() => (history ? exerciseSessions(history.sets, exerciseId) : []), [history, exerciseId]);
  const prs = useMemo(() => personalRecords(sessions), [sessions]);

  if (!history) return null;
  if (sessions.length === 0) {
    return (
      <Card>
        <AppText variant="label" muted>
          Verlauf & Rekorde
        </AppText>
        <AppText muted>Noch nicht trainiert. Nach dem ersten Workout siehst du hier Fortschritt und Bestwerte.</AppText>
      </Card>
    );
  }

  const points = sessions
    .map((s) => ({ x: s.date, y: metric.pick(s) }))
    .filter((p): p is { x: number; y: number } => p.y !== null && p.y > 0);
  const fmt = (v: number) => formatPRValue(metric.key, v, unit);
  const fields = fieldsFor(loggingType);
  const shown = showAll ? [...sessions].reverse() : [...sessions].reverse().slice(0, 5);
  const relevantPRs = prs.filter((p) => metrics.some((m) => m.key === p.kind));

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader>Fortschritt</SectionHeader>
      <Card>
        {metrics.length > 1 && (
          <ChipRow>
            {metrics.map((m) => (
              <Chip key={m.key} label={m.label} selected={m.key === metric.key} onPress={() => setMetricKey(m.key)} />
            ))}
          </ChipRow>
        )}
        {points.length === 0 ? (
          <AppText muted>Für diese Kennzahl gibt es noch keine Werte.</AppText>
        ) : (
          <LineChart
            accessibilityLabel={`${metric.label} über ${points.length} Einheiten, aktuell ${fmt(points[points.length - 1].y)}`}
            points={points}
            formatY={fmt}
            formatX={(x) => new Date(x).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
          />
        )}
      </Card>

      {relevantPRs.length > 0 && (
        <>
          <SectionHeader>Bestwerte 🏆</SectionHeader>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {relevantPRs.map((p) => (
              <StatTile
                key={p.kind}
                label={PR_LABELS[p.kind]}
                value={formatPRValue(p.kind, p.value, unit)}
                sub={new Date(p.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: '2-digit' })}
              />
            ))}
          </View>
        </>
      )}

      <SectionHeader>Verlauf ({sessions.length})</SectionHeader>
      <Card style={{ paddingVertical: spacing.xs }}>
        {shown.map((s, i) => (
          <View key={s.workoutId}>
            {i > 0 && <Divider />}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: s.workoutId } })}
              style={{ paddingVertical: spacing.md, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText style={{ fontWeight: '600' }}>
                  {new Date(s.date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}
                </AppText>
                <AppText muted>{s.sets} Sätze</AppText>
              </View>
              <AppText variant="caption" muted>
                Bester Satz: {s.bestSet ? formatSetValues(s.bestSet, fields, unit) : '–'}
                {s.best1RM ? ` · 1RM ≈ ${formatWeight(s.best1RM, unit)}` : ''}
                {s.volume ? ` · ${formatVolume(s.volume, unit)}` : ''}
                {!s.volume && s.maxDuration ? ` · ${formatDuration(s.maxDuration)}` : ''}
                {!s.volume && !s.maxDuration && s.totalReps ? ` · ${formatNumber(s.totalReps)} Wdh. gesamt` : ''}
              </AppText>
            </Pressable>
          </View>
        ))}
      </Card>
      {sessions.length > 5 && (
        <Chip label={showAll ? 'Weniger anzeigen' : `Alle ${sessions.length} anzeigen`} onPress={() => setShowAll(!showAll)} />
      )}
    </View>
  );
}
