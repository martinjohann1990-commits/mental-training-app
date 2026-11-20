import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { allMeasurementsQuery, customFieldsQuery } from '@/db/repo/body';
import { type MeasureField, type MeasureUnit, STANDARD_FIELDS } from '@/domain/body';

/** Alle Messfelder (Standard + eigene) und alle Messwerte. */
export function useBodyData() {
  const { data: entries, updatedAt } = useLiveQuery(allMeasurementsQuery());
  const { data: custom } = useLiveQuery(customFieldsQuery());
  const fields = useMemo<MeasureField[]>(
    () => [
      ...STANDARD_FIELDS,
      ...custom.map((f) => ({ key: `custom:${f.id}`, label: f.name, unit: f.unit as MeasureUnit, custom: true })),
    ],
    [custom],
  );
  return { fields, entries, loaded: !!updatedAt };
}
