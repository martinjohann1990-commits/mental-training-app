import type { PhotoPose } from '@/db/schema';

export const POSES: { value: PhotoPose; label: string }[] = [
  { value: 'front', label: 'Vorne' },
  { value: 'side', label: 'Seite' },
  { value: 'back', label: 'Hinten' },
  { value: 'other', label: 'Sonstige' },
];

export const poseLabel = (p: PhotoPose) => POSES.find((x) => x.value === p)?.label ?? p;
