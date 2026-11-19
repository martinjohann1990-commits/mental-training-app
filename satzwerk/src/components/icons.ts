import type { Equipment, Muscle } from '@/domain/catalog';

import type { IconName } from './ui';

export const EQUIPMENT_ICONS: Record<Equipment, IconName> = {
  barbell: 'weight-lifter',
  dumbbell: 'dumbbell',
  kettlebell: 'kettlebell',
  ez_bar: 'weight',
  bench: 'seat-flat',
  rack: 'gate',
  cable: 'rowing',
  machine: 'cog-outline',
  pullup_bar: 'minus',
  band: 'vector-curve',
  bodyweight: 'human-handsup',
};

export function exerciseIcon(primary: Muscle, equipment: Equipment[]): IconName {
  if (primary === 'cardio') return 'run';
  if (equipment.includes('kettlebell')) return 'kettlebell';
  if (equipment.length === 0) return 'human-handsup';
  return EQUIPMENT_ICONS[equipment[0]];
}
