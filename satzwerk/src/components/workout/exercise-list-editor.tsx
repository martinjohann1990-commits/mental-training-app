import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import * as ops from '@/domain/draft-ops';
import { dumbbellWeights } from '@/domain/equipment';
import { type DraftExercise, type DraftSet, type IntervalConfig, type SetValues, toggleSupersetWithNext } from '@/domain/workout';
import { useActiveEquipment } from '@/hooks/use-equipment';
import { useEquipmentCatalog } from '@/hooks/use-equipment-catalog';
import { useExerciseMap } from '@/hooks/use-exercise-map';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';

import { ExercisePicker } from '../exercise-picker';
import { Button } from '../ui';
import { type CardMode, ExerciseCard } from './exercise-card';
import { IntervalTimer } from './interval-timer';
import { ExerciseMenuSheet, PlateCalculatorSheet, SetDetailSheet, WeightPickerSheet } from './sheets';

type Props = {
  mode: CardMode;
  exercises: DraftExercise[];
  onChange: (fn: (list: DraftExercise[]) => DraftExercise[]) => void;
  previous?: Record<string, SetValues[]>;
  /** Nur im Workout-Modus. */
  onToggleSet?: (exKey: string, setKey: string) => void;
  onIntervalResult?: (exKey: string, config: IntervalConfig, totalReps: number | null) => void;
};

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Übungsliste mit allen Bearbeitungs-Sheets. Gemeinsam für Live-Workout und Routinen-Editor. */
export function ExerciseListEditor({ mode, exercises, onChange, previous, onToggleSet, onIntervalResult }: Props) {
  const map = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const equipment = useActiveEquipment();
  const { byRef: equipmentByRef } = useEquipmentCatalog();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [setFor, setSetFor] = useState<{ ex: string; set: string } | null>(null);
  const [weightFor, setWeightFor] = useState<{ ex: string; set: string } | null>(null);
  const [platesFor, setPlatesFor] = useState<string | null>(null);
  const [intervalFor, setIntervalFor] = useState<string | null>(null);

  const kbWeights = equipment?.config.kettlebells ?? [];
  const dbWeights = useMemo(() => (equipment ? dumbbellWeights(equipment.config.dumbbells) : []), [equipment]);

  /** Feste Gewichtsstufen für eine Übung: KB-Stufen bzw. Kurzhantel-Raster. */
  const weightOptionsFor = (exerciseId: string): number[] | null => {
    const info = map.get(exerciseId);
    if (!info) return null;
    // Eigene Geräte mit hinterlegten Gewichten haben Vorrang.
    const custom = info.equipment.map((e) => equipmentByRef.get(e)).find((e) => e?.custom && e.weights.length > 0);
    if (custom) return custom.weights;
    if (info.equipment.includes('kettlebell')) return kbWeights;
    if (info.equipment.includes('dumbbell') && !info.equipment.includes('barbell')) return dbWeights;
    return null;
  };

  const supersetLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const e of exercises) {
      if (e.supersetGroup === null) continue;
      const group = exercises.filter((x) => x.supersetGroup === e.supersetGroup);
      const letter = GROUP_LETTERS[(e.supersetGroup - 1) % GROUP_LETTERS.length];
      labels.set(e.key, `${group.length > 2 ? 'Zirkel' : 'Supersatz'} ${letter}${group.indexOf(e) + 1}`);
    }
    return labels;
  }, [exercises]);

  const menuIndex = exercises.findIndex((e) => e.key === menuFor);
  const menuEx = exercises[menuIndex];
  const setEx = exercises.find((e) => e.key === setFor?.ex);
  const setObj = setEx?.sets.find((s) => s.key === setFor?.set);
  const weightEx = exercises.find((e) => e.key === weightFor?.ex);
  const weightSet = weightEx?.sets.find((s) => s.key === weightFor?.set);
  const intervalEx = exercises.find((e) => e.key === intervalFor);
  const platesEx = exercises.find((e) => e.key === platesFor);

  const patchSet = (exKey: string, setKey: string, patch: Partial<DraftSet>) =>
    onChange((l) => ops.patchSet(l, exKey, setKey, patch));

  return (
    <View style={{ gap: spacing.md }}>
      {exercises.map((ex) => {
        const info = map.get(ex.exerciseId);
        return (
          <ExerciseCard
            key={ex.key}
            mode={mode}
            exercise={ex}
            info={info}
            unit={unit}
            previous={previous?.[ex.exerciseId]}
            hasWeightOptions={!!weightOptionsFor(ex.exerciseId)?.length}
            supersetLabel={supersetLabels.get(ex.key) ?? null}
            onOpenMenu={() => setMenuFor(ex.key)}
            onOpenSet={(setKey) => setSetFor({ ex: ex.key, set: setKey })}
            onPickWeight={(setKey) => setWeightFor({ ex: ex.key, set: setKey })}
            onPatchSet={(setKey, patch) => patchSet(ex.key, setKey, patch)}
            onAddSet={() => onChange((l) => ops.addSet(l, ex.key))}
            onToggleSet={onToggleSet ? (setKey) => onToggleSet(ex.key, setKey) : undefined}
            onStartInterval={ex.interval && onIntervalResult ? () => setIntervalFor(ex.key) : undefined}
          />
        );
      })}

      <Button title="Übung hinzufügen" icon="plus" variant="secondary" onPress={() => setPickerOpen(true)} />

      <ExercisePicker
        visible={pickerOpen}
        multi
        onClose={() => setPickerOpen(false)}
        onPickMany={(ids) => {
          onChange((l) => ops.addExercises(l, ids));
          setPickerOpen(false);
        }}
        onPick={(id) => {
          onChange((l) => ops.addExercises(l, [id]));
          setPickerOpen(false);
        }}
      />

      <ExerciseMenuSheet
        key={menuFor ?? 'none'}
        visible={!!menuEx}
        onClose={() => setMenuFor(null)}
        exercise={menuEx}
        name={menuEx ? (map.get(menuEx.exerciseId)?.name ?? 'Übung') : ''}
        canMoveUp={menuIndex > 0}
        canMoveDown={menuIndex >= 0 && menuIndex < exercises.length - 1}
        hasNext={menuIndex >= 0 && menuIndex < exercises.length - 1}
        linkedWithNext={
          !!menuEx && menuEx.supersetGroup !== null && exercises[menuIndex + 1]?.supersetGroup === menuEx.supersetGroup
        }
        showPlates={!!menuEx && !!equipment && !!map.get(menuEx.exerciseId)?.equipment.includes('barbell')}
        onAction={(a) => {
          if (!menuEx) return;
          const k = menuEx.key;
          switch (a.type) {
            case 'note':
              onChange((l) => ops.patchExercise(l, k, { note: a.note }));
              break;
            case 'rest':
              onChange((l) => ops.patchExercise(l, k, { restSeconds: a.seconds }));
              break;
            case 'interval':
              onChange((l) => ops.patchExercise(l, k, { interval: a.config }));
              break;
            case 'superset':
              onChange((l) => toggleSupersetWithNext(l, l.findIndex((e) => e.key === k)));
              setMenuFor(null);
              break;
            case 'up':
            case 'down':
              onChange((l) => ops.moveExercise(l, k, a.type === 'up' ? -1 : 1));
              setMenuFor(null);
              break;
            case 'remove':
              onChange((l) => ops.removeExercise(l, k));
              setMenuFor(null);
              break;
            case 'plates':
              setMenuFor(null);
              setPlatesFor(k);
              break;
            case 'details':
              setMenuFor(null);
              router.push({ pathname: '/exercise/[id]', params: { id: menuEx.exerciseId } });
              break;
          }
        }}
      />

      <SetDetailSheet
        visible={!!setObj}
        set={setObj}
        showRpe={mode === 'workout'}
        onClose={() => setSetFor(null)}
        onPatch={(patch) => setFor && patchSet(setFor.ex, setFor.set, patch)}
        onDelete={() => {
          if (setFor) onChange((l) => ops.removeSet(l, setFor.ex, setFor.set));
          setSetFor(null);
        }}
      />

      <WeightPickerSheet
        visible={!!weightSet}
        title={weightEx ? (map.get(weightEx.exerciseId)?.name ?? 'Gewicht') : 'Gewicht'}
        options={weightEx ? (weightOptionsFor(weightEx.exerciseId) ?? []) : []}
        value={weightSet?.weight ?? null}
        unit={unit}
        onClose={() => setWeightFor(null)}
        onPick={(kg) => {
          if (weightFor) patchSet(weightFor.ex, weightFor.set, { weight: kg });
          setWeightFor(null);
        }}
      />

      {platesEx && equipment && (
        <PlateCalculatorSheet
          visible
          onClose={() => setPlatesFor(null)}
          initialKg={platesEx.sets.find((s) => !s.completed && s.weight)?.weight ?? platesEx.sets[0]?.weight ?? null}
          equipment={equipment.config}
          unit={unit}
        />
      )}

      {intervalEx?.interval && (
        <IntervalTimer
          visible
          config={intervalEx.interval}
          exerciseName={map.get(intervalEx.exerciseId)?.name ?? 'Intervall'}
          onClose={() => setIntervalFor(null)}
          onFinish={(reps) => {
            onIntervalResult?.(intervalEx.key, intervalEx.interval!, reps);
            setIntervalFor(null);
          }}
        />
      )}
    </View>
  );
}
