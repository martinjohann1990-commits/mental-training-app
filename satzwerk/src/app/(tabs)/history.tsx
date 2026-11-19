import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Divider, EmptyState, Icon, ListRow, Segmented } from '@/components/ui';
import { recentWorkoutsQuery, type WorkoutListItem } from '@/db/repo/workouts';
import { addMonths, startOfMonth } from '@/domain/stats';
import { formatDuration, formatVolume } from '@/domain/units';
import { useSettings } from '@/stores/settings';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const FEELINGS = ['😫', '😕', '😐', '🙂', '🔥'];

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function WorkoutRow({ w }: { w: WorkoutListItem }) {
  const unit = useSettings((s) => s.unit);
  return (
    <ListRow
      icon="dumbbell"
      title={`${w.name}${w.rating ? ` ${FEELINGS[w.rating - 1]}` : ''}`}
      subtitle={`${w.startedAt.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatDuration(
        (w.endedAt.getTime() - w.startedAt.getTime()) / 1000,
      )} · ${w.setCount} Sätze · ${formatVolume(w.volume, unit)}`}
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
    />
  );
}

function Calendar({ workouts }: { workouts: WorkoutListItem[] }) {
  const c = useColors();
  const [month, setMonth] = useState(() => startOfMonth(Date.now()));
  const [selected, setSelected] = useState<string | null>(null);
  const [today] = useState(() => Date.now());

  const byDay = useMemo(() => {
    const m = new Map<string, WorkoutListItem[]>();
    for (const w of workouts) {
      const k = dayKey(w.startedAt.getTime());
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return m;
  }, [workouts]);

  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const todayKey = dayKey(today);
  const monthCount = workouts.filter((w) => startOfMonth(w.startedAt.getTime()) === month).length;
  const selectedList = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Vorheriger Monat" hitSlop={10} onPress={() => { setMonth(addMonths(month, -1)); setSelected(null); }}>
            <Icon name="chevron-left" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="heading">
              {MONTHS[first.getMonth()]} {first.getFullYear()}
            </AppText>
            <AppText variant="caption" muted>
              {monthCount} {monthCount === 1 ? 'Workout' : 'Workouts'}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Nächster Monat" hitSlop={10} onPress={() => { setMonth(addMonths(month, 1)); setSelected(null); }}>
            <Icon name="chevron-right" />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {WEEKDAYS.map((d) => (
            <AppText key={d} variant="caption" muted style={styles.cellLabel}>
              {d}
            </AppText>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <View key={`e${i}`} style={styles.cell} />;
            const k = `${first.getFullYear()}-${first.getMonth()}-${day}`;
            const has = byDay.has(k);
            const isSel = selected === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`${day}. ${MONTHS[first.getMonth()]}${has ? `, ${byDay.get(k)!.length} Workout` : ''}`}
                disabled={!has}
                onPress={() => setSelected(isSel ? null : k)}
                style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    has && { backgroundColor: isSel ? c.accent : c.accentMuted },
                    k === todayKey && { borderWidth: 1, borderColor: c.textMuted },
                  ]}>
                  <AppText style={{ fontWeight: has ? '800' : '500', color: has ? (isSel ? c.onAccent : c.accent) : c.text }}>{day}</AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
      {selectedList.length > 0 && (
        <Card style={{ paddingVertical: spacing.xs }}>
          {selectedList.map((w, i) => (
            <View key={w.id}>
              {i > 0 && <Divider />}
              <WorkoutRow w={w} />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const { data: workouts } = useLiveQuery(recentWorkoutsQuery(5000));

  const groups = useMemo(() => {
    const m = new Map<number, WorkoutListItem[]>();
    for (const w of workouts) {
      const k = startOfMonth(w.startedAt.getTime());
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return [...m.entries()];
  }, [workouts]);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Segmented
        options={[
          { value: 'list', label: 'Liste' },
          { value: 'calendar', label: 'Kalender' },
        ]}
        value={view}
        onChange={setView}
      />
      {workouts.length === 0 ? (
        <EmptyState icon="history" title="Noch keine Workouts" text="Gespeicherte Workouts erscheinen hier." />
      ) : view === 'calendar' ? (
        <Calendar workouts={workouts} />
      ) : (
        groups.map(([month, list]) => {
          const d = new Date(month);
          return (
            <View key={month} style={{ gap: spacing.sm }}>
              <AppText variant="label" muted style={{ textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.sm }}>
                {MONTHS[d.getMonth()]} {d.getFullYear()} · {list.length}
              </AppText>
              <Card style={{ paddingVertical: spacing.xs }}>
                {list.map((w, i) => (
                  <View key={w.id}>
                    {i > 0 && <Divider />}
                    <WorkoutRow w={w} />
                  </View>
                ))}
              </Card>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  cellLabel: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  day: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
