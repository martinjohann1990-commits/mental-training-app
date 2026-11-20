import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { readSetting, writeSetting } from '@/db/repo/settings';
import { workoutStartsQuery } from '@/db/repo/workouts';
import { shouldRemindBackup } from '@/domain/backup';

const DAY = 86_400_000;

/** Backup-Status und ob die Erinnerung angezeigt werden soll. Aktualisiert sich bei Fokus. */
export function useBackupReminder() {
  const { data: starts } = useLiveQuery(workoutStartsQuery());
  const [state, setState] = useState<{ lastBackupAt: number | null; snoozedUntil: number | null; now: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([readSetting('lastBackupAt'), readSetting('backupSnoozedUntil')]).then(([last, snooze]) => {
        if (!cancelled) setState({ lastBackupAt: typeof last === 'number' ? last : null, snoozedUntil: typeof snooze === 'number' ? snooze : null, now: Date.now() });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const firstDataAt = starts.length ? Math.min(...starts.map((s) => s.startedAt.getTime())) : null;
  const result = state ? shouldRemindBackup({ ...state, firstDataAt }) : { remind: false, daysSince: null };

  const snooze = () => {
    const until = Date.now() + 3 * DAY;
    void writeSetting('backupSnoozedUntil', until);
    setState((s) => (s ? { ...s, snoozedUntil: until } : s));
  };

  return { ...result, lastBackupAt: state?.lastBackupAt ?? null, snooze };
}
