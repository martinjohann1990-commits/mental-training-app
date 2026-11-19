import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { allProfilesQuery } from '@/db/repo/equipment';
import { parseEquipmentConfig } from '@/domain/equipment';
import { useSettings } from '@/stores/settings';

export function useEquipmentProfiles() {
  return useLiveQuery(allProfilesQuery()).data;
}

/** Aktives Equipment-Profil (fällt auf das erste Profil zurück, falls das aktive gelöscht wurde). */
export function useActiveEquipment() {
  const profiles = useEquipmentProfiles();
  const activeId = useSettings((s) => s.activeProfileId);
  const profile = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;
  return profile ? { ...profile, config: parseEquipmentConfig(profile.config) } : null;
}
