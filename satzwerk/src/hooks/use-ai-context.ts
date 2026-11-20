import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

import { allExercisesQuery } from '@/db/repo/exercises';
import { readSetting, writeSetting } from '@/db/repo/settings';
import { type AIProfile, DEFAULT_AI_PROFILE, describeEquipment } from '@/domain/ai-plan';
import { canPerform, dumbbellWeights } from '@/domain/equipment';
import { useActiveEquipment } from '@/hooks/use-equipment';
import { useEquipmentCatalog } from '@/hooks/use-equipment-catalog';

/** KI-Profil (gespeichert in den Einstellungen) und Equipment-Kontext für Prompts. */
export function useAIContext() {
  const [profile, setProfileState] = useState<AIProfile | null>(null);
  const active = useActiveEquipment();
  const { label, items } = useEquipmentCatalog();
  const { data: exercises } = useLiveQuery(allExercisesQuery());

  useEffect(() => {
    void readSetting('aiProfile').then((p) => setProfileState({ ...DEFAULT_AI_PROFILE, ...((p as Partial<AIProfile>) ?? {}) }));
  }, []);

  const setProfile = (p: AIProfile) => {
    setProfileState(p);
    void writeSetting('aiProfile', p);
  };

  const equipmentText = useMemo(
    () =>
      active
        ? describeEquipment(active.config, label, items.filter((i) => i.custom).map((i) => ({ ref: i.ref, name: i.label, weights: i.weights })))
        : '- Körpergewicht',
    [active, label, items],
  );

  /** Übungsnamen, die mit dem aktiven Profil machbar sind (für den Prompt). */
  const availableNames = useMemo(
    () => exercises.filter((e) => !active || canPerform(active.config, e.equipment)).map((e) => e.name),
    [exercises, active],
  );

  /** Gewichtsstufen für eine Übung (zum Einrasten importierter Gewichte). */
  const weightOptionsFor = (equipment: string[]): number[] | null => {
    const custom = equipment.map((r) => items.find((i) => i.ref === r)).find((i) => i?.custom && i.weights.length);
    if (custom) return custom.weights;
    if (!active) return null;
    if (equipment.includes('kettlebell')) return active.config.kettlebells;
    if (equipment.includes('dumbbell') && !equipment.includes('barbell')) return dumbbellWeights(active.config.dumbbells);
    return null;
  };

  return { profile, setProfile, equipmentText, availableNames, exercises, weightOptionsFor, profileName: active?.name ?? '–' };
}
