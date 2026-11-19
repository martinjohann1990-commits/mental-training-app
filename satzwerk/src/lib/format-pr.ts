import type { PRKind } from '@/domain/stats';
import { formatDuration, formatNumber, formatVolume, formatWeight, type Unit } from '@/domain/units';

export function formatPRValue(kind: PRKind, value: number, unit: Unit): string {
  switch (kind) {
    case 'weight':
    case 'e1rm':
      return formatWeight(value, unit);
    case 'volume':
      return formatVolume(value, unit);
    case 'duration':
      return formatDuration(value);
    case 'distance':
      return `${formatNumber(value)} m`;
    case 'reps':
      return `${value} Wdh.`;
  }
}
