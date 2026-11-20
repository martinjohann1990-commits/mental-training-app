import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { setHabitValue } from '@/db/repo/habits';
import { formatDay, formatMeasure, type MeasureUnit } from '@/domain/body';
import type { Forecast } from '@/domain/goals';
import { heatmap, isDayDone } from '@/domain/habits';
import { formatWeight, type Unit } from '@/domain/units';
import type { GoalWithEval } from '@/hooks/use-goals';
import type { HabitWithStats } from '@/hooks/use-habits';
import { formatDecimal, parseDecimal } from '@/lib/number';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { Sheet } from './sheet';
import { AppText, Button, Icon, TextField } from './ui';

// ── Gewohnheiten ──────────────────────────────────────────────

export function habitTargetText(h: HabitWithStats): string {
  if (h.kind === 'workouts') return `${h.timesPerWeek ?? 1}× Training pro Woche`;
  const base = h.kind === 'number' ? `${formatDecimal(h.dailyTarget ?? 1)}${h.unit ? ` ${h.unit}` : ''} am Tag` : 'Ja/Nein';
  return h.frequency === 'weekly' ? `${base} · ${h.timesPerWeek}× pro Woche` : `${base} · täglich`;
}

/** Zeile zum schnellen Abhaken bzw. Eintragen für heute. */
export function HabitTodayRow({ h, day }: { h: HabitWithStats; day: string }) {
  const c = useColors();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const done = h.kind === 'workouts' ? h.streak.doneNow : isDayDone(h, h.todayValue);
  const streakText = h.streak.current > 0 ? `🔥 ${h.streak.current} ${h.streak.unit}` : null;
  const weekly = h.frequency === 'weekly' || h.kind === 'workouts';

  const sub = [
    weekly ? `${h.streak.periodCount}/${h.streak.periodTarget} diese Woche` : null,
    h.kind === 'number' ? `${formatDecimal(h.todayValue)}/${formatDecimal(h.dailyTarget ?? 1)}${h.unit ? ` ${h.unit}` : ''} heute` : null,
    streakText,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${h.name} – Details`}
        onPress={() => router.push({ pathname: '/habits/[id]', params: { id: h.id } })}
        style={{ flex: 1 }}>
        <AppText style={{ fontWeight: '600' }}>{h.name}</AppText>
        <AppText variant="caption" muted>
          {sub || habitTargetText(h)}
        </AppText>
      </Pressable>

      {h.kind === 'check' && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`${h.name} heute erledigt`}
          onPress={() => void setHabitValue(h.id, day, done ? null : 1)}
          style={[styles.check, { backgroundColor: done ? c.accent : c.surfaceAlt }]}>
          <Icon name="check" size={22} color={done ? c.onAccent : c.textMuted} />
        </Pressable>
      )}

      {h.kind === 'number' && (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${h.name}: Wert eintragen`}
            onPress={() => {
              setText(h.todayValue ? formatDecimal(h.todayValue) : '');
              setEditing(true);
            }}
            style={[styles.check, { backgroundColor: done ? c.accent : c.surfaceAlt, width: 'auto', paddingHorizontal: spacing.md }]}>
            <AppText style={{ fontWeight: '800', color: done ? c.onAccent : c.text }}>{formatDecimal(h.todayValue)}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${h.name}: plus eins`}
            onPress={() => void setHabitValue(h.id, day, h.todayValue + 1)}
            style={[styles.check, { backgroundColor: c.surfaceAlt }]}>
            <Icon name="plus" size={20} />
          </Pressable>
        </View>
      )}

      {h.kind === 'workouts' && (
        <View style={[styles.check, { backgroundColor: done ? c.accent : c.surfaceAlt }]} accessibilityLabel={done ? 'Wochenziel erreicht' : 'Wochenziel offen'}>
          <Icon name={done ? 'check' : 'dumbbell'} size={20} color={done ? c.onAccent : c.textMuted} />
        </View>
      )}

      <Sheet visible={editing} onClose={() => setEditing(false)} title={`${h.name} heute`}>
        <View style={{ gap: spacing.md }}>
          <TextField
            label={`Wert${h.unit ? ` (${h.unit})` : ''} – Ziel ${formatDecimal(h.dailyTarget ?? 1)}`}
            keyboardType="decimal-pad"
            value={text}
            onChangeText={setText}
            autoFocus
          />
          <Button
            title="Speichern"
            onPress={() => {
              const n = text.trim() === '' ? null : parseDecimal(text);
              void setHabitValue(h.id, day, n);
              setEditing(false);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

/** Kalender-Heatmap: Spalten = Wochen, Zeilen = Mo–So. Tippen schaltet Ja/Nein-Tage um. */
export function HabitHeatmap({ h, today, weeks = 17 }: { h: HabitWithStats; today: string; weeks?: number }) {
  const c = useColors();
  const cols = heatmap(h, h.values, today, weeks);
  const editable = h.kind === 'check';
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <View style={{ gap: 3, marginRight: 2 }}>
          {['Mo', '', 'Mi', '', 'Fr', '', 'So'].map((d, i) => (
            <AppText key={i} variant="caption" muted style={{ height: 14, fontSize: 10, lineHeight: 14 }}>
              {d}
            </AppText>
          ))}
        </View>
        {cols.map((col) => (
          <View key={col[0].day} style={{ gap: 3, flex: 1 }}>
            {col.map((cell) => (
              <Pressable
                key={cell.day}
                disabled={!editable || cell.future}
                accessibilityLabel={`${formatDay(cell.day)}: ${cell.level > 0 ? 'erledigt' : 'offen'}`}
                onPress={() => void setHabitValue(h.id, cell.day, cell.level > 0 ? null : 1)}
                style={{
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: cell.future ? 'transparent' : cell.level > 0 ? c.accent : c.surfaceAlt,
                  opacity: cell.level > 0 ? 0.35 + 0.65 * cell.level : 1,
                  borderWidth: cell.day === today ? 1 : 0,
                  borderColor: c.text,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <AppText variant="caption" muted>
        Letzte {weeks} Wochen{editable ? ' · Kästchen antippen zum Nachtragen' : ''}
      </AppText>
    </View>
  );
}

// ── Ziele ─────────────────────────────────────────────────────

export function formatGoalValue(g: Pick<GoalWithEval, 'type' | 'refId'>, value: number, unit: Unit, measureUnit?: MeasureUnit, habitUnit?: string): string {
  if (g.type === 'strength') return formatWeight(value, unit);
  if (g.type === 'bodyweight') return formatMeasure(value, 'kg', unit);
  if (g.type === 'measurement') return formatMeasure(value, measureUnit ?? 'cm', unit);
  return `${Math.round(value)} ${habitUnit ?? 'Tage'}`;
}

export function forecastText(f: Forecast): string {
  switch (f.kind) {
    case 'reached':
      return 'Ziel erreicht 🎉';
    case 'unknown':
      return 'Prognose ab mehr Daten (mind. 2 Werte über 3+ Tage)';
    case 'away':
      return 'Aktueller Trend geht (noch) nicht in Zielrichtung';
    case 'date': {
      const d = new Date(f.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
      const track = f.onTrack === null ? '' : f.onTrack ? ' – vor der Deadline ✓' : ' – nach der Deadline';
      return `Bei aktuellem Tempo erreicht am ${d}${track}`;
    }
  }
}

export function ProgressBar({ value, done }: { value: number; done?: boolean }) {
  const c = useColors();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(value * 100)}%`, height: 8, borderRadius: 4, backgroundColor: done ? c.success : c.accent }} />
    </View>
  );
}

export function GoalCard({
  g,
  unit,
  measureUnit,
  habitUnit,
}: {
  g: GoalWithEval;
  unit: Unit;
  measureUnit?: MeasureUnit;
  habitUnit?: string;
}) {
  const c = useColors();
  const e = g.evaluation;
  const fmt = (v: number) => formatGoalValue(g, v, unit, measureUnit, habitUnit);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ziel ${g.title}, ${Math.round(e.progress * 100)} Prozent`}
      onPress={() => router.push({ pathname: '/goals/[id]', params: { id: g.id } })}
      style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <AppText style={{ fontWeight: '700', flex: 1 }} numberOfLines={2}>
          {e.reached ? '🏆 ' : ''}
          {g.title}
        </AppText>
        <AppText style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>{Math.round(e.progress * 100)} %</AppText>
      </View>
      <ProgressBar value={e.progress} done={e.reached} />
      <AppText variant="caption" muted>
        {e.current !== null ? fmt(e.current) : '–'} von {fmt(g.targetValue)}
        {g.deadline ? ` · bis ${formatDay(g.deadline, true)}` : ''}
      </AppText>
      <AppText variant="caption" style={{ color: e.reached ? c.success : c.textMuted }}>
        {forecastText(e.forecast)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  check: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
