import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useMemo } from 'react';

import { equipmentIcon } from '@/components/icons';
import type { IconName } from '@/components/ui';
import { customEquipmentQuery } from '@/db/repo/custom-equipment';
import { EQUIPMENT, EQUIPMENT_KEYS, type EquipmentRef, isCustomEquipment } from '@/domain/catalog';

export type EquipmentItem = { ref: EquipmentRef; label: string; icon: IconName; custom: boolean; weights: number[] };

/** Alle Geräte (fest + eigene) mit Namen, Icon und ggf. Gewichten. */
export function useEquipmentCatalog() {
  const { data: custom } = useLiveQuery(customEquipmentQuery());
  const items = useMemo<EquipmentItem[]>(
    () => [
      ...EQUIPMENT_KEYS.map((k) => ({ ref: k as EquipmentRef, label: EQUIPMENT[k], icon: equipmentIcon(k), custom: false, weights: [] })),
      ...custom.map((c) => ({ ref: `custom:${c.id}` as EquipmentRef, label: c.name, icon: equipmentIcon(`custom:${c.id}`), custom: true, weights: c.weights })),
    ],
    [custom],
  );
  const byRef = useMemo(() => new Map(items.map((i) => [i.ref, i])), [items]);
  const label = useCallback(
    (ref: EquipmentRef) => byRef.get(ref)?.label ?? (isCustomEquipment(ref) ? 'Gelöschtes Gerät' : ref),
    [byRef],
  );
  return { items, byRef, label, custom };
}
