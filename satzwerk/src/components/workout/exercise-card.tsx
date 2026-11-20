import { Pressable, StyleSheet, View } from 'react-native';

import type { ExerciseRow } from '@/db/schema';
import { describeInterval } from '@/domain/interval';
import { formatDuration, formatWeight, fromDisplayWeight, toDisplayWeight, type Unit } from '@/domain/units';
import { type DraftExercise, type DraftSet, fieldsFor, nextSetType, SET_TYPES, type SetValues } from '@/domain/workout';
import { formatDecimal } from '@/lib/number';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { AppText, Button, Icon } from '../ui';
import { DurationCell, NumberCell, PickerCell } from './inputs';

export type CardMode = 'workout' | 'routine';

type Props = {
  mode: CardMode;
  exercise: DraftExercise;
  info: ExerciseRow | undefined;
  unit: Unit;
  previous?: SetValues[];
  /** Feste Gewichtsstufen (KB/KH) → Gewichtsfeld öffnet Auswahl. */
  hasWeightOptions?: boolean;
  supersetLabel?: string | null;
  onOpenMenu: () => void;
  onOpenSet: (setKey: string) => void;
  onPickWeight: (setKey: string) => void;
  onPatchSet: (setKey: string, patch: Partial<DraftSet>) => void;
  onAddSet: () => void;
  onRemoveSet?: (setKey: string) => void;
  onToggleSet?: (setKey: string) => void;
  onStartInterval?: () => void;
};

const FIELD_LABEL: Record<keyof SetValues, string> = {
  weight: 'kg',
  reps: 'Wdh.',
  repsRight: 'R',
  duration: 'Zeit',
  distance: 'm',
};

export function formatSetValues(s: SetValues, fields: (keyof SetValues)[], unit: Unit): string {
  const parts: string[] = [];
  for (const f of fields) {
    const v = s[f];
    if (v === null || v === undefined) continue;
    if (f === 'weight') parts.push(formatWeight(v, unit));
    else if (f === 'reps') parts.push(fields.includes('repsRight') ? `L${v}` : `× ${v}`);
    else if (f === 'repsRight') parts.push(`R${v}`);
    else if (f === 'duration') parts.push(formatDuration(v));
    else if (f === 'distance') parts.push(`${formatDecimal(v)} m`);
  }
  return parts.join(' ');
}

export function ExerciseCard(props: Props) {
  const { mode, exercise, info, unit, previous, supersetLabel } = props;
  const c = useColors();
  const loggingType = info?.loggingType ?? 'weight_reps';
  const fields = fieldsFor(loggingType);
  const isBodyweight = loggingType === 'bodyweight_reps';
  let workingIndex = 0;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderLeftColor: supersetLabel ? c.accent : 'transparent' },
      ]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {supersetLabel && (
            <AppText variant="caption" accent style={{ fontWeight: '700' }}>
              {supersetLabel}
            </AppText>
          )}
          <AppText variant="heading" accent numberOfLines={2}>
            {info?.name ?? 'Unbekannte Übung'}
          </AppText>
          <AppText variant="caption" muted>
            Pause {exercise.restSeconds > 0 ? formatDuration(exercise.restSeconds) : 'aus'}
            {exercise.interval ? ` · ${describeInterval(exercise.interval)}` : ''}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Optionen für ${info?.name ?? 'Übung'}`} onPress={props.onOpenMenu} hitSlop={10} style={{ padding: 4 }}>
          <Icon name="dots-vertical" color={c.textMuted} />
        </Pressable>
      </View>

      {exercise.note ? (
        <AppText variant="caption" muted style={{ fontStyle: 'italic' }}>
          {exercise.note}
        </AppText>
      ) : null}

      {exercise.interval && mode === 'workout' && props.onStartInterval && (
        <Button title={`${describeInterval(exercise.interval)} starten`} icon="timer-outline" small onPress={props.onStartInterval} />
      )}

      <View style={styles.row}>
        <AppText variant="caption" muted style={styles.colSet}>
          Satz
        </AppText>
        {mode === 'workout' && (
          <AppText variant="caption" muted style={styles.colPrev}>
            Vorher
          </AppText>
        )}
        {fields.map((f) => (
          <AppText key={f} variant="caption" muted style={styles.colField}>
            {f === 'weight' ? (isBodyweight ? `+${unit}` : unit) : f === 'reps' && fields.includes('repsRight') ? 'L' : FIELD_LABEL[f]}
          </AppText>
        ))}
        {props.onRemoveSet && <View style={mode === 'workout' ? styles.colX : styles.colCheck} />}
        {mode === 'workout' && <View style={styles.colCheck} />}
      </View>

      {exercise.sets.map((s, i) => {
        const prev = previous?.[i];
        const label = s.type === 'normal' ? String(++workingIndex) : SET_TYPES[s.type].short;
        const rowBg = s.completed ? c.accentMuted : 'transparent';
        return (
          <View key={s.key} style={[styles.row, { backgroundColor: rowBg, borderRadius: radius.sm }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Satz ${i + 1}, ${SET_TYPES[s.type].label}. Tippen ändert den Typ, lange drücken für Details`}
              onPress={() => props.onPatchSet(s.key, { type: nextSetType(s.type) })}
              onLongPress={() => props.onOpenSet(s.key)}
              style={styles.colSet}>
              <AppText
                style={{
                  fontWeight: '800',
                  textAlign: 'center',
                  color: s.type === 'normal' ? c.text : s.type === 'warmup' ? '#E8B019' : c.danger,
                }}>
                {label}
              </AppText>
              {(s.rpe !== null || !!s.note) && (
                <AppText variant="caption" muted style={{ textAlign: 'center', fontSize: 10 }}>
                  {s.rpe !== null ? `@${formatDecimal(s.rpe)}` : '✎'}
                </AppText>
              )}
            </Pressable>
            {mode === 'workout' && (
              <Pressable
                accessibilityLabel="Werte vom letzten Mal übernehmen"
                disabled={!prev}
                onPress={() => prev && props.onPatchSet(s.key, { ...prev })}
                style={styles.colPrev}>
                <AppText variant="caption" muted numberOfLines={2} style={{ textAlign: 'center' }}>
                  {prev ? formatSetValues(prev, fields, unit) : '–'}
                </AppText>
              </Pressable>
            )}
            {fields.map((f) => {
              const a11y = `${FIELD_LABEL[f]} Satz ${i + 1}`;
              const prevV = prev?.[f] ?? null;
              if (f === 'weight') {
                if (props.hasWeightOptions) {
                  return (
                    <View key={f} style={styles.colField}>
                      <PickerCell
                        accessibilityLabel={`Gewicht Satz ${i + 1}`}
                        label={s.weight !== null ? formatDecimal(toDisplayWeight(s.weight, unit)) : null}
                        placeholder={prevV !== null ? formatDecimal(toDisplayWeight(prevV, unit)) : '–'}
                        completed={s.completed}
                        onPress={() => props.onPickWeight(s.key)}
                      />
                    </View>
                  );
                }
                return (
                  <View key={f} style={styles.colField}>
                    <NumberCell
                      accessibilityLabel={`Gewicht Satz ${i + 1}`}
                      value={s.weight !== null ? toDisplayWeight(s.weight, unit) : null}
                      placeholder={prevV !== null ? formatDecimal(toDisplayWeight(prevV, unit)) : '0'}
                      completed={s.completed}
                      allowNegative={isBodyweight}
                      onChange={(v) => props.onPatchSet(s.key, { weight: v === null ? null : fromDisplayWeight(v, unit) })}
                    />
                  </View>
                );
              }
              if (f === 'duration') {
                return (
                  <View key={f} style={styles.colField}>
                    <DurationCell
                      accessibilityLabel={a11y}
                      value={s.duration}
                      placeholder={prevV !== null ? formatDuration(prevV) : undefined}
                      completed={s.completed}
                      onChange={(v) => props.onPatchSet(s.key, { duration: v })}
                    />
                  </View>
                );
              }
              return (
                <View key={f} style={styles.colField}>
                  <NumberCell
                    accessibilityLabel={a11y}
                    value={s[f]}
                    integer={f !== 'distance'}
                    placeholder={prevV !== null ? formatDecimal(prevV) : '0'}
                    completed={s.completed}
                    onChange={(v) => props.onPatchSet(s.key, { [f]: v })}
                  />
                </View>
              );
            })}
            {props.onRemoveSet && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Satz ${i + 1} entfernen`}
                hitSlop={4}
                onPress={() => props.onRemoveSet?.(s.key)}
                style={[mode === 'workout' ? styles.colX : styles.colCheck, styles.check, { backgroundColor: 'transparent' }]}>
                <Icon name="close" size={20} color={c.textMuted} />
              </Pressable>
            )}
            {mode === 'workout' && props.onToggleSet && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.completed }}
                accessibilityLabel={`Satz ${i + 1} abhaken`}
                onPress={() => props.onToggleSet?.(s.key)}
                style={[styles.colCheck, styles.check, { backgroundColor: s.completed ? c.accent : c.surfaceAlt }]}>
                <Icon name="check" size={20} color={s.completed ? c.onAccent : c.textMuted} />
              </Pressable>
            )}
          </View>
        );
      })}

      <Button title="Satz hinzufügen" icon="plus" variant="secondary" small onPress={props.onAddSet} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderLeftWidth: 3 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 2 },
  colSet: { width: 34, alignItems: 'center', textAlign: 'center' },
  colPrev: { flex: 1.3, minWidth: 0, alignItems: 'center', textAlign: 'center' },
  colField: { flex: 1, minWidth: 0, alignItems: 'stretch', textAlign: 'center' },
  colCheck: { width: 40 },
  colX: { width: 26 },
  check: { height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
