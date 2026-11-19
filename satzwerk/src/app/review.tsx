import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { StatTile } from '@/components/charts';
import { AppText, Card, Divider, Icon, ListRow, SectionHeader } from '@/components/ui';
import { addMonths, addWeeks, PR_LABELS, percentChange, startOfMonth, startOfWeek, summarizePeriod, type PeriodSummary } from '@/domain/stats';
import { formatHours, formatNumber, formatVolume } from '@/domain/units';
import { useExerciseMap } from '@/hooks/use-exercise-map';
import { useHistory } from '@/hooks/use-history';
import { formatPRValue } from '@/lib/format-pr';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const FEELINGS = ['😫', '😕', '😐', '🙂', '🔥'];

function delta(cur: number, prev: number): string | null {
  const p = percentChange(cur, prev);
  if (p === null) return null;
  return `${p > 0 ? '+' : ''}${p} % zum Vorzeitraum`;
}

/** Kurzer, automatisch formulierter Rückblick. */
function headline(s: PeriodSummary, prev: PeriodSummary, kind: 'week' | 'month'): string {
  const span = kind === 'week' ? 'diese Woche' : 'diesen Monat';
  if (s.workouts === 0) return `Kein Workout ${span}. Jeder Neustart zählt!`;
  const parts = [`${s.workouts} ${s.workouts === 1 ? 'Workout' : 'Workouts'} an ${s.trainingDays} ${s.trainingDays === 1 ? 'Tag' : 'Tagen'}`];
  const v = percentChange(s.volume, prev.volume);
  if (v !== null && Math.abs(v) >= 5) parts.push(v > 0 ? `${v} % mehr Volumen als davor` : `${-v} % weniger Volumen als davor`);
  if (s.prs.length > 0) parts.push(`${s.prs.length} ${s.prs.length === 1 ? 'neuer Rekord' : 'neue Rekorde'} 🏆`);
  return `${parts.join(', ')}.`;
}

export default function ReviewScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ kind?: string; offset?: string }>();
  const kind = params.kind === 'month' ? 'month' : 'week';
  const offset = Math.min(0, parseInt(params.offset ?? '0', 10) || 0);
  const history = useHistory();
  const map = useExerciseMap();
  const unit = useSettings((s) => s.unit);

  const [now] = useState(() => Date.now());
  const range = useMemo(() => {
    if (kind === 'week') {
      const start = addWeeks(startOfWeek(now), offset);
      return { start, end: addWeeks(start, 1), prevStart: addWeeks(start, -1) };
    }
    const start = addMonths(startOfMonth(now), offset);
    return { start, end: addMonths(start, 1), prevStart: addMonths(start, -1) };
  }, [kind, offset, now]);

  const result = useMemo(() => {
    if (!history) return null;
    return {
      cur: summarizePeriod(history.sets, history.workouts, range.start, range.end),
      prev: summarizePeriod(history.sets, history.workouts, range.prevStart, range.start),
    };
  }, [history, range]);

  const s0 = new Date(range.start);
  const e0 = new Date(range.end - 1);
  const title =
    kind === 'week'
      ? `${s0.getDate()}.${s0.getMonth() + 1}. – ${e0.getDate()}.${e0.getMonth() + 1}.${e0.getFullYear()}`
      : `${MONTHS[s0.getMonth()]} ${s0.getFullYear()}`;
  const go = (o: number) => router.setParams({ kind, offset: String(o) });

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: kind === 'week' ? 'Wochenrückblick' : 'Monatsrückblick' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Vorheriger Zeitraum" hitSlop={10} onPress={() => go(offset - 1)}>
          <Icon name="chevron-left" />
        </Pressable>
        <AppText variant="heading" style={{ flex: 1, textAlign: 'center' }}>
          {title}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nächster Zeitraum"
          hitSlop={10}
          disabled={offset >= 0}
          onPress={() => go(offset + 1)}
          style={{ opacity: offset >= 0 ? 0.3 : 1 }}>
          <Icon name="chevron-right" />
        </Pressable>
      </View>

      {result && (
        <>
          <Card>
            <AppText style={{ fontSize: 17, lineHeight: 24 }}>{headline(result.cur, result.prev, kind)}</AppText>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <StatTile label="Workouts" value={String(result.cur.workouts)} sub={delta(result.cur.workouts, result.prev.workouts)} />
            <StatTile label="Trainingszeit" value={formatHours(result.cur.durationSec)} sub={delta(result.cur.durationSec, result.prev.durationSec)} />
            <StatTile label="Volumen" value={formatVolume(result.cur.volume, unit)} sub={delta(result.cur.volume, result.prev.volume)} />
            <StatTile label="Arbeitssätze" value={String(result.cur.sets)} sub={delta(result.cur.sets, result.prev.sets)} />
          </View>
          {(result.cur.avgRating !== null || result.cur.avgEnergy !== null) && (
            <Card>
              <AppText variant="label" muted>
                Wie es sich angefühlt hat
              </AppText>
              {result.cur.avgRating !== null && (
                <AppText>
                  Gefühl Ø {formatNumber(result.cur.avgRating, 1)} / 5 {FEELINGS[Math.round(result.cur.avgRating) - 1]}
                </AppText>
              )}
              {result.cur.avgEnergy !== null && <AppText>Energie Ø {formatNumber(result.cur.avgEnergy, 1)} / 5</AppText>}
            </Card>
          )}

          {result.cur.prs.length > 0 && (
            <>
              <SectionHeader>Rekorde 🏆</SectionHeader>
              <Card style={{ paddingVertical: spacing.xs }}>
                {result.cur.prs.map((p, i) => (
                  <View key={`${p.workoutId}-${p.exerciseId}-${p.kind}`}>
                    {i > 0 && <Divider />}
                    <ListRow
                      icon="trophy-outline"
                      title={map.get(p.exerciseId)?.name ?? 'Übung'}
                      subtitle={`${PR_LABELS[p.kind]}: ${formatPRValue(p.kind, p.value, unit)}`}
                      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: p.workoutId } })}
                    />
                  </View>
                ))}
              </Card>
            </>
          )}

          {result.cur.topExercises.length > 0 && (
            <>
              <SectionHeader>Meist trainiert</SectionHeader>
              <Card>
                {result.cur.topExercises.map((t, i) => (
                  <View key={t.exerciseId} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <AppText muted style={{ width: 20 }}>
                      {i + 1}.
                    </AppText>
                    <AppText style={{ flex: 1 }}>{map.get(t.exerciseId)?.name ?? 'Übung'}</AppText>
                    <AppText muted>{t.sets} Sätze</AppText>
                  </View>
                ))}
              </Card>
            </>
          )}
          {result.cur.workouts === 0 && (
            <AppText muted style={{ textAlign: 'center', color: c.textMuted }}>
              Keine Workouts in diesem Zeitraum.
            </AppText>
          )}
        </>
      )}
    </ScrollView>
  );
}
