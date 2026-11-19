import { useState } from 'react';
import { View } from 'react-native';

import { DEFAULT_INTERVALS, describeInterval } from '@/domain/interval';
import type { EquipmentConfig } from '@/domain/equipment';
import { calculatePlates } from '@/domain/plates';
import { formatDuration, formatWeight, fromDisplayWeight, toDisplayWeight, type Unit } from '@/domain/units';
import type { DraftExercise, DraftSet, IntervalConfig } from '@/domain/workout';
import { formatDecimal, parseDecimal } from '@/lib/number';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { Sheet, SheetItem } from '../sheet';
import { AppText, Button, Chip, ChipRow, Segmented, TextField } from '../ui';

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

/** Gewichtsauswahl für feste Stufen (Kettlebells, Kurzhanteln) plus freie Eingabe. */
export function WeightPickerSheet({
  visible,
  onClose,
  options,
  value,
  unit,
  onPick,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  options: number[];
  value: number | null;
  unit: Unit;
  onPick: (kg: number | null) => void;
  title: string;
}) {
  const [custom, setCustom] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ChipRow>
        {options.map((w) => (
          <Chip
            key={w}
            label={formatWeight(w, unit)}
            selected={value !== null && Math.abs(value - w) < 0.01}
            onPress={() => onPick(w)}
          />
        ))}
      </ChipRow>
      {options.length === 0 && (
        <AppText muted>Im aktiven Equipment-Profil sind keine Gewichte hinterlegt.</AppText>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end', marginTop: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={`Anderes Gewicht (${unit})`}
            keyboardType="decimal-pad"
            value={custom}
            onChangeText={setCustom}
            placeholder="z. B. 18"
          />
        </View>
        <Button
          title="OK"
          small
          onPress={() => {
            const n = parseDecimal(custom);
            if (n !== null) {
              onPick(fromDisplayWeight(n, unit));
              setCustom('');
            }
          }}
        />
      </View>
      <Button title="Gewicht leeren" variant="ghost" small onPress={() => onPick(null)} />
    </Sheet>
  );
}

export function SetDetailSheet({
  visible,
  onClose,
  set,
  onPatch,
  onDelete,
  showRpe,
}: {
  visible: boolean;
  onClose: () => void;
  set: DraftSet | undefined;
  onPatch: (patch: Partial<DraftSet>) => void;
  onDelete: () => void;
  showRpe: boolean;
}) {
  if (!set) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title="Satz-Details">
      <Segmented
        options={[
          { value: 'warmup', label: 'Aufw.' },
          { value: 'normal', label: 'Normal' },
          { value: 'drop', label: 'Drop' },
          { value: 'failure', label: 'Versagen' },
        ]}
        value={set.type}
        onChange={(type) => onPatch({ type })}
      />
      {showRpe && (
        <>
          <AppText variant="label" muted style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            RPE (Anstrengung, optional)
          </AppText>
          <ChipRow>
            {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => (
              <Chip
                key={r}
                label={formatDecimal(r)}
                selected={set.rpe === r}
                onPress={() => onPatch({ rpe: set.rpe === r ? null : r })}
              />
            ))}
          </ChipRow>
          <AppText variant="caption" muted style={{ marginTop: spacing.xs }}>
            10 = nichts mehr drin · 8 = noch 2 Wdh. möglich
          </AppText>
        </>
      )}
      <View style={{ marginTop: spacing.lg }}>
        <TextField
          label="Notiz zum Satz"
          value={set.note}
          onChangeText={(note) => onPatch({ note })}
          placeholder="z. B. Griff war rutschig"
        />
      </View>
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button title="Fertig" onPress={onClose} />
        <Button title="Satz löschen" icon="trash-can-outline" variant="danger" onPress={onDelete} />
      </View>
    </Sheet>
  );
}

export function ExerciseMenuSheet({
  visible,
  onClose,
  exercise,
  name,
  canMoveUp,
  canMoveDown,
  linkedWithNext,
  hasNext,
  showPlates,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  exercise: DraftExercise | undefined;
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  linkedWithNext: boolean;
  hasNext: boolean;
  showPlates: boolean;
  onAction: (
    a:
      | { type: 'note'; note: string }
      | { type: 'rest'; seconds: number }
      | { type: 'interval'; config: IntervalConfig | null }
      | { type: 'superset' | 'up' | 'down' | 'remove' | 'plates' | 'details' },
  ) => void;
}) {
  const c = useColors();
  const [view, setView] = useState<'main' | 'rest' | 'note' | 'interval'>('main');
  const [note, setNote] = useState('');
  const [interval, setIntervalCfg] = useState<IntervalConfig>(DEFAULT_INTERVALS.emom);
  if (!exercise) return null;
  const close = () => {
    setView('main');
    onClose();
  };
  const num = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  return (
    <Sheet visible={visible} onClose={close} title={name}>
      {view === 'main' && (
        <>
          <SheetItem icon="information-outline" label="Übung ansehen" onPress={() => onAction({ type: 'details' })} />
          <SheetItem
            icon="note-edit-outline"
            label={exercise.note ? 'Notiz bearbeiten' : 'Notiz hinzufügen'}
            onPress={() => {
              setNote(exercise.note);
              setView('note');
            }}
          />
          <SheetItem
            icon="timer-sand"
            label="Pausenzeit"
            hint={exercise.restSeconds > 0 ? formatDuration(exercise.restSeconds) : 'Aus'}
            onPress={() => setView('rest')}
          />
          {hasNext && (
            <SheetItem
              icon={linkedWithNext ? 'link-variant-off' : 'link-variant'}
              label={linkedWithNext ? 'Supersatz mit nächster Übung lösen' : 'Supersatz mit nächster Übung'}
              hint="Pause erst nach der letzten Übung der Runde"
              onPress={() => onAction({ type: 'superset' })}
            />
          )}
          <SheetItem
            icon="timer-outline"
            label="Intervall-Modus"
            hint={exercise.interval ? describeInterval(exercise.interval) : 'EMOM, AMRAP, Intervall/Tabata'}
            onPress={() => {
              setIntervalCfg(exercise.interval ?? DEFAULT_INTERVALS.emom);
              setView('interval');
            }}
          />
          {showPlates && <SheetItem icon="calculator-variant-outline" label="Scheibenrechner" onPress={() => onAction({ type: 'plates' })} />}
          {canMoveUp && <SheetItem icon="arrow-up" label="Nach oben" onPress={() => onAction({ type: 'up' })} />}
          {canMoveDown && <SheetItem icon="arrow-down" label="Nach unten" onPress={() => onAction({ type: 'down' })} />}
          <SheetItem icon="trash-can-outline" label="Übung entfernen" danger onPress={() => onAction({ type: 'remove' })} />
        </>
      )}

      {view === 'rest' && (
        <>
          <ChipRow>
            {REST_OPTIONS.map((s) => (
              <Chip
                key={s}
                label={s === 0 ? 'Aus' : formatDuration(s)}
                selected={exercise.restSeconds === s}
                onPress={() => {
                  onAction({ type: 'rest', seconds: s });
                  setView('main');
                }}
              />
            ))}
          </ChipRow>
          <Button title="Zurück" variant="ghost" small onPress={() => setView('main')} />
        </>
      )}

      {view === 'note' && (
        <View style={{ gap: spacing.md }}>
          <TextField value={note} onChangeText={setNote} multiline placeholder="z. B. Sitzhöhe 4, enger Griff" autoFocus />
          <Button
            title="Speichern"
            onPress={() => {
              onAction({ type: 'note', note: note.trim() });
              setView('main');
            }}
          />
        </View>
      )}

      {view === 'interval' && (
        <View style={{ gap: spacing.md }}>
          <Segmented
            options={[
              { value: 'emom', label: 'EMOM' },
              { value: 'amrap', label: 'AMRAP' },
              { value: 'tabata', label: 'Intervall' },
            ]}
            value={interval.mode}
            onChange={(m) => setIntervalCfg(DEFAULT_INTERVALS[m])}
          />
          <AppText variant="caption" muted>
            {interval.mode === 'emom'
              ? 'Jede Minute startet eine neue Runde. Rest der Minute = Pause.'
              : interval.mode === 'amrap'
                ? 'So viele Wiederholungen/Runden wie möglich in der Zeit.'
                : 'Feste Arbeits- und Pausenphasen, z. B. 20 s / 10 s × 8 (Tabata).'}
          </AppText>
          {interval.mode === 'emom' && (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField label="Minuten" keyboardType="number-pad" defaultValue={String(interval.minutes)}
                  onChangeText={(v) => setIntervalCfg({ ...interval, minutes: num(v, interval.minutes) })} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Wdh. pro Minute" keyboardType="number-pad" defaultValue={interval.repsPerMinute ? String(interval.repsPerMinute) : ''}
                  onChangeText={(v) => setIntervalCfg({ ...interval, repsPerMinute: parseInt(v, 10) > 0 ? parseInt(v, 10) : null })} />
              </View>
            </View>
          )}
          {interval.mode === 'amrap' && (
            <TextField label="Minuten" keyboardType="number-pad" defaultValue={String(interval.minutes)}
              onChangeText={(v) => setIntervalCfg({ ...interval, minutes: num(v, interval.minutes) })} />
          )}
          {interval.mode === 'tabata' && (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField label="Arbeit (s)" keyboardType="number-pad" defaultValue={String(interval.workSeconds)}
                  onChangeText={(v) => setIntervalCfg({ ...interval, workSeconds: num(v, interval.workSeconds) })} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Pause (s)" keyboardType="number-pad" defaultValue={String(interval.restSeconds)}
                  onChangeText={(v) => { const n = parseInt(v, 10); setIntervalCfg({ ...interval, restSeconds: Number.isFinite(n) && n >= 0 ? n : interval.restSeconds }); }} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Runden" keyboardType="number-pad" defaultValue={String(interval.rounds)}
                  onChangeText={(v) => setIntervalCfg({ ...interval, rounds: num(v, interval.rounds) })} />
              </View>
            </View>
          )}
          <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}>
            <AppText style={{ fontWeight: '700' }}>{describeInterval(interval)}</AppText>
          </View>
          <Button title="Übernehmen" onPress={() => { onAction({ type: 'interval', config: interval }); setView('main'); }} />
          {exercise.interval && (
            <Button title="Intervall-Modus entfernen" variant="danger" onPress={() => { onAction({ type: 'interval', config: null }); setView('main'); }} />
          )}
          <Button title="Zurück" variant="ghost" small onPress={() => setView('main')} />
        </View>
      )}
    </Sheet>
  );
}

export function PlateCalculatorSheet({
  visible,
  onClose,
  initialKg,
  equipment,
  unit,
}: {
  visible: boolean;
  onClose: () => void;
  initialKg: number | null;
  equipment: EquipmentConfig;
  unit: Unit;
}) {
  const c = useColors();
  const [text, setText] = useState(initialKg ? formatDecimal(toDisplayWeight(initialKg, unit)) : '');
  const parsed = parseDecimal(text);
  const targetKg = parsed !== null ? fromDisplayWeight(parsed, unit) : null;
  const result = targetKg !== null ? calculatePlates(targetKg, equipment.barbell.barWeight, equipment.barbell.plates) : null;
  const maxPlate = Math.max(1, ...equipment.barbell.plates.map((p) => p.weight));

  return (
    <Sheet visible={visible} onClose={onClose} title="Scheibenrechner">
      <TextField label={`Zielgewicht (${unit})`} keyboardType="decimal-pad" value={text} onChangeText={setText} />
      <AppText variant="caption" muted style={{ marginTop: spacing.xs }}>
        Stange {formatWeight(equipment.barbell.barWeight, unit)} · Scheiben aus deinem aktiven Equipment-Profil
      </AppText>
      {result && (
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <AppText variant="label" muted>
            Pro Seite
          </AppText>
          {result.perSide.length === 0 ? (
            <AppText>Nur die Stange.</AppText>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 110 }}>
              <View style={{ width: 28, height: 10, backgroundColor: c.textMuted, borderRadius: 2 }} />
              {result.perSide.flatMap((p) =>
                Array.from({ length: p.count }, (_, i) => (
                  <View
                    key={`${p.weight}-${i}`}
                    accessibilityLabel={`${formatDecimal(p.weight)} Kilogramm`}
                    style={{
                      width: 16,
                      height: 40 + 70 * (p.weight / maxPlate),
                      backgroundColor: c.accent,
                      opacity: 0.55 + 0.45 * (p.weight / maxPlate),
                      borderRadius: 3,
                    }}
                  />
                )),
              )}
            </View>
          )}
          {result.perSide.map((p) => (
            <AppText key={p.weight}>
              {p.count} × {formatDecimal(p.weight)} kg
            </AppText>
          ))}
          {result.missing > 0.001 && (
            <AppText style={{ color: c.danger }}>
              Mit deinem Bestand erreichbar: {formatWeight(result.achieved, unit)} (fehlen {formatWeight(result.missing, unit)})
            </AppText>
          )}
        </View>
      )}
      <View style={{ marginTop: spacing.lg }}>
        <Button title="Schließen" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
